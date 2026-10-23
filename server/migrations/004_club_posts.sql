-- posts only exist as club updates now
DELETE FROM posts WHERE club_id IS NULL;
ALTER TABLE posts ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE posts DROP COLUMN category_id, DROP COLUMN cover_image;
ALTER TABLE posts RENAME COLUMN user_id TO author_id;
ALTER TABLE posts ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE posts DROP CONSTRAINT posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_posts_category;
DROP INDEX IF EXISTS idx_posts_user;
CREATE INDEX idx_posts_club_created ON posts(club_id, created_at DESC);
DROP INDEX IF EXISTS idx_posts_club;

DROP TABLE likes;
DROP TABLE comments;
DROP TABLE categories;
