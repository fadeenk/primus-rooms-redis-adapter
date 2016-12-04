local namespace = 'bumblebee'
local sparkID = assert(KEYS[1], 'The spark ID is missing')

--
-- Get all the rooms that the spark is a member of so we can remove it from the db
--
local rooms = redis.call('SMEMBERS', namespace ..'sparks:' .. sparkID)

--
-- Iterate over all the rooms in our db and remove the spark from it
--
for i = 1, #rooms do
  redis.call('SREM', namespace ..'rooms:' .. rooms[i], sparkID)
end

--
-- Delete socket's information from the db
--
redis.call('DEL', namespace ..'sparks:' .. sparkID);

return 1
