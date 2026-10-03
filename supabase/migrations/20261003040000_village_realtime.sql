-- Village (docs/DESIGN.md §9): one private Realtime channel, topic 'village'.
-- Signed-in players see who is around (presence) and talk in speech bubbles
-- (broadcast). Nothing is stored. Clients put only public profile fields in
-- their presence (built from get_public_profile).

create policy "players can listen in the village"
  on realtime.messages for select to authenticated
  using (
    (select realtime.topic()) = 'village'
    and realtime.messages.extension in ('presence', 'broadcast')
  );

create policy "players can show up and talk in the village"
  on realtime.messages for insert to authenticated
  with check (
    (select realtime.topic()) = 'village'
    and realtime.messages.extension in ('presence', 'broadcast')
  );
