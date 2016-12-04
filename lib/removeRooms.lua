local namespace = 'bumblebee'
local room = assert(KEYS[1], 'The room is missing')

--
-- Get all the sparks that are members of the room so we can remove it from the db
--
local sparks = redis.call('SMEMBERS', namespace ..'rooms:' .. room)

--
-- Iterate over all the sparks in our db and remove the room from it
--
for i = 1, #sparks do
  redis.call('SREM', namespace ..'sparks:' .. sparks[i], room)
end

--
-- Delete room's information from the db
--
redis.call('DEL', namespace ..'rooms:' .. room);

return 1
