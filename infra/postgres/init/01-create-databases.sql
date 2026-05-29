-- Creates one database per microservice (database-per-service pattern).
-- Runs automatically on first Postgres container start.
CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE community_db;
CREATE DATABASE post_db;
CREATE DATABASE comment_db;
CREATE DATABASE vote_db;
CREATE DATABASE notification_db;
