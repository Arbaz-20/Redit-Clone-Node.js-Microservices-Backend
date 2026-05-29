import amqp, { Channel, ChannelModel } from 'amqplib';
import { logger } from './logger';

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'reddit.events';
const URL = process.env.RABBITMQ_URL || 'amqp://reddit:reddit_pass@rabbitmq:5672';

let channel: Channel | null = null;

async function connectWithRetry(retries = 10, delayMs = 3000): Promise<ChannelModel> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await amqp.connect(URL);
      logger.info('Connected to RabbitMQ');
      return conn;
    } catch (err: any) {
      logger.warn(`RabbitMQ connect attempt ${attempt}/${retries} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to RabbitMQ after retries');
}

export async function initBroker(): Promise<void> {
  const conn = await connectWithRetry();
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  channel = ch;

  conn.on('close', () => {
    logger.error('RabbitMQ connection closed, exiting for restart');
    process.exit(1);
  });
}

// Publish a domain event. routingKey examples: "user.created", "post.created".
export function publishEvent(routingKey: string, payload: unknown): void {
  if (!channel) {
    logger.error('publishEvent called before broker init');
    return;
  }
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
  logger.info(`Published ${routingKey}`);
}

// Subscribe a durable queue to one or more routing keys.
export async function consumeEvents(
  queue: string,
  routingKeys: string[],
  handler: (routingKey: string, payload: any) => Promise<void> | void
): Promise<void> {
  if (!channel) throw new Error('consumeEvents called before broker init');
  const q = await channel.assertQueue(queue, { durable: true });
  for (const key of routingKeys) {
    await channel.bindQueue(q.queue, EXCHANGE, key);
  }
  await channel.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(msg.fields.routingKey, payload);
      channel!.ack(msg);
    } catch (err: any) {
      logger.error(`Error handling ${msg.fields.routingKey}: ${err.message}`);
      channel!.nack(msg, false, false); // drop poison messages
    }
  });
  logger.info(`Consuming ${queue} <- [${routingKeys.join(', ')}]`);
}
