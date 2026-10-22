-- accounts are identified by email now; username stays only for old rows
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
UPDATE users SET email = username || '@campushub.local' WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

ALTER TABLE users RENAME COLUMN password TO password_hash;
ALTER TABLE users DROP COLUMN bio, DROP COLUMN avatar_url;

DROP TABLE password_resets;
