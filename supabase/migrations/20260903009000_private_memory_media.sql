begin;

-- Apply only after every deployed frontend resolves canonical memory pointers
-- into authenticated short-lived URLs.
update storage.buckets
set public = false
where id = 'memory-images';

commit;
