-- ── Film Intelligence test seed ───────────────────────────────────────────────
-- Run in Supabase SQL Editor.
-- Replace YOUR_ORG_TOKEN with your actual org token before running.
-- To find it: SELECT token FROM organizations LIMIT 10;
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org  text := 'ORG-B381FD-12E8AE';   -- org token

  v_film uuid;
  v_play uuid;
  i      int;
  j      int;

  -- 20 plays with varied attributes
  play_types  text[]    := ARRAY['pass','pass','run','pass','run','kick','pass','run','pass','pass','run','pass','run','pass','kick','pass','run','pass','run','pass'];
  formations  text[]    := ARRAY['shotgun','shotgun','under_center','pistol','under_center','shotgun','shotgun','under_center','pistol','shotgun','under_center','shotgun','pistol','shotgun','shotgun','pistol','under_center','shotgun','under_center','shotgun'];
  downs_arr   int[]     := ARRAY[1,2,1,3,2,4,1,2,3,1,2,1,3,2,4,1,2,3,1,2];
  dists_arr   int[]     := ARRAY[10,8,10,4,6,1,10,7,5,10,6,10,3,9,2,10,8,4,10,7];
  results_arr text[]    := ARRAY['success','failure','success','success','failure','success','td','failure','success','success','failure','success','failure','success','success','td','failure','success','failure','success'];
  yards_arr   numeric[] := ARRAY[8.0,-2.0,5.5,4.0,2.0,35.0,22.0,-1.0,7.5,6.0,3.0,12.0,0.5,9.0,28.0,65.0,-3.0,11.0,1.0,8.5];
  zones_arr   text[]    := ARRAY['midfield','midfield','own_territory','red_zone','midfield','red_zone','red_zone','own_territory','midfield','midfield','own_territory','midfield','red_zone','midfield','red_zone','red_zone','own_territory','midfield','own_territory','midfield'];

  -- 6 home players: jersey, position label, snap_x, snap_y
  h_jerseys int[]     := ARRAY[7,  12,    22,    24,    54,    87  ];
  h_snap_x  numeric[] := ARRAY[26.65, 26.65, 5.0, 48.0, 35.0, 26.65];
  h_snap_y  numeric[] := ARRAY[50.0,  47.5,  50.0, 50.0, 50.0, 48.5];
  -- route deltas per player (dx per step, dy per step)
  h_dx numeric[] := ARRAY[0.0, 0.0,  8.0, -8.0, 3.0, 0.5];
  h_dy numeric[] := ARRAY[0.3, 4.5, 12.0, 12.0, 6.0, 3.0];
  -- speed profile per player
  h_max_spd numeric[] := ARRAY[14.5, 18.2, 21.4, 22.8, 11.3, 19.7];
  h_avg_spd numeric[] := ARRAY[8.2,  11.5, 14.1, 15.3, 7.8,  12.4];
  h_accel   numeric[] := ARRAY[5.2,  6.8,  8.1,  8.9,  4.3,  7.5];
  h_step    int[]     := ARRAY[210,  185,  165,  172,  240,  190];
  h_dist    numeric[] := ARRAY[6.5,  15.2, 22.8, 24.1, 9.4,  18.3];

  v_t0     numeric;
  v_route  jsonb;
BEGIN

  -- ── 1. Create test film ────────────────────────────────────────────────────
  INSERT INTO game_films (
    org_id, title, sport, game_date, opponent,
    home_team, away_team,
    status, progress_pct, play_count, duration_secs
  )
  VALUES (
    v_org,
    'vs Lincoln HS — Week 1 (TEST)',
    'football',
    '2025-09-05',
    'Lincoln HS',
    'Home Team',
    'Lincoln HS',
    'ready', 100, 20, 620
  )
  RETURNING id INTO v_film;

  RAISE NOTICE 'Created film: %', v_film;

  -- ── 2. Create 20 plays ────────────────────────────────────────────────────
  FOR i IN 1..20 LOOP
    v_t0 := (i - 1) * 30.0 + 5.0;   -- plays spaced 30s apart, clip starts at 5s

    INSERT INTO game_plays (
      film_id, org_id, play_number,
      start_time_secs, end_time_secs,
      formation, play_type,
      down, distance, field_zone,
      yards_gained, result, tagged_by
    )
    VALUES (
      v_film, v_org, i,
      v_t0, v_t0 + 6.5,
      formations[i], play_types[i],
      downs_arr[i], dists_arr[i], zones_arr[i],
      yards_arr[i], results_arr[i], 'auto'
    )
    RETURNING id INTO v_play;

    -- ── 3. Home players (6 per play) ──────────────────────────────────────
    FOR j IN 1..6 LOOP
      -- 8-point route at 5fps: t = v_t0 + 0, 0.2, 0.4, ... 1.4 secs
      v_route := jsonb_build_array(
        jsonb_build_object('t', v_t0+0.0, 'x', h_snap_x[j],               'y', h_snap_y[j],               'vx', 0,              'vy', 0),
        jsonb_build_object('t', v_t0+0.2, 'x', h_snap_x[j]+h_dx[j]*0.05,  'y', h_snap_y[j]+h_dy[j]*0.05,  'vx', h_dx[j]*0.2,   'vy', h_dy[j]*0.2),
        jsonb_build_object('t', v_t0+0.4, 'x', h_snap_x[j]+h_dx[j]*0.15,  'y', h_snap_y[j]+h_dy[j]*0.15,  'vx', h_dx[j]*0.5,   'vy', h_dy[j]*0.5),
        jsonb_build_object('t', v_t0+0.6, 'x', h_snap_x[j]+h_dx[j]*0.3,   'y', h_snap_y[j]+h_dy[j]*0.3,   'vx', h_dx[j]*0.8,   'vy', h_dy[j]*0.8),
        jsonb_build_object('t', v_t0+0.8, 'x', h_snap_x[j]+h_dx[j]*0.55,  'y', h_snap_y[j]+h_dy[j]*0.55,  'vx', h_dx[j]*1.0,   'vy', h_dy[j]*1.0),
        jsonb_build_object('t', v_t0+1.0, 'x', h_snap_x[j]+h_dx[j]*0.75,  'y', h_snap_y[j]+h_dy[j]*0.75,  'vx', h_dx[j]*0.9,   'vy', h_dy[j]*0.9),
        jsonb_build_object('t', v_t0+1.2, 'x', h_snap_x[j]+h_dx[j]*0.9,   'y', h_snap_y[j]+h_dy[j]*0.9,   'vx', h_dx[j]*0.6,   'vy', h_dy[j]*0.6),
        jsonb_build_object('t', v_t0+1.4, 'x', h_snap_x[j]+h_dx[j]*1.0,   'y', h_snap_y[j]+h_dy[j]*1.0,   'vx', h_dx[j]*0.3,   'vy', h_dy[j]*0.3)
      );

      INSERT INTO player_tracks (
        play_id, film_id, org_id,
        jersey_number, jersey_confidence, team,
        snap_x, snap_y, route_json,
        max_speed_mph, avg_speed_mph, accel_peak_ms2,
        first_step_ms, distance_traveled_yd
      )
      VALUES (
        v_play, v_film, v_org,
        h_jerseys[j],
        0.88 + (j * 0.02),
        'home',
        h_snap_x[j],
        h_snap_y[j],
        v_route,
        h_max_spd[j] + (i % 3) * 0.4,   -- slight variation across plays
        h_avg_spd[j] + (i % 4) * 0.2,
        h_accel[j],
        h_step[j] - (i % 5) * 5,
        h_dist[j] + (i % 3) * 0.8
      );
    END LOOP;

    -- ── 4. Away players (5 per play, no jersey tracking) ──────────────────
    FOR j IN 1..5 LOOP
      INSERT INTO player_tracks (
        play_id, film_id, org_id,
        jersey_number, jersey_confidence, team,
        snap_x, snap_y,
        max_speed_mph, avg_speed_mph, distance_traveled_yd
      )
      VALUES (
        v_play, v_film, v_org,
        20 + j,
        0.72 + j * 0.03,
        'away',
        8.0 + j * 9.0,
        50.5,
        9 + j * 1.5,
        6 + j * 0.8,
        4 + j * 1.2
      );
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Seeded 20 plays + 220 player tracks under film % for org %', v_film, v_org;

END $$;
