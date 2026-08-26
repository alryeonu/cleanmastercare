begin;

create table kb.guide_enrichments (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'ko-KR',
  area_hint text not null check (area_hint in ('desk', 'sink', 'sofa', 'bed', 'shoe_rack', 'bathroom', 'kitchen', 'other')),
  focus_code text not null references kb.focuses(code),
  severity text not null check (severity in ('light', 'moderate', 'heavy', 'unknown')),
  surface_hint text not null check (surface_hint in ('hard_surface', 'ceramic_tile', 'glass', 'metal', 'fabric', 'wood', 'unknown')),
  summary text not null check (btrim(summary) <> ''),
  safety_note text not null check (btrim(safety_note) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (locale, area_hint, focus_code, severity, surface_hint)
);

create table kb.product_recommendations (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'ko-KR',
  area_hint text not null check (area_hint in ('desk', 'sink', 'sofa', 'bed', 'shoe_rack', 'bathroom', 'kitchen', 'other')),
  focus_code text not null references kb.focuses(code),
  surface_hint text not null check (surface_hint in ('hard_surface', 'ceramic_tile', 'glass', 'metal', 'fabric', 'wood', 'unknown')),
  product_type text not null check (btrim(product_type) <> ''),
  product_name text not null check (btrim(product_name) <> ''),
  purpose text not null check (btrim(purpose) <> ''),
  caution text not null check (btrim(caution) <> ''),
  product_query text not null check (btrim(product_query) <> ''),
  image_url text not null check (image_url ~ '^https://'),
  priority smallint not null default 100 check (priority between 0 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index guide_enrichments_lookup_idx on kb.guide_enrichments(locale, area_hint, focus_code, severity, surface_hint) where active;
create index product_recommendations_lookup_idx on kb.product_recommendations(locale, area_hint, focus_code, surface_hint, priority) where active;

alter table kb.guide_enrichments enable row level security;
alter table kb.product_recommendations enable row level security;
revoke all on table kb.guide_enrichments from public, anon, authenticated;
revoke all on table kb.product_recommendations from public, anon, authenticated;
grant usage on schema kb to service_role;
grant select on table kb.guide_enrichments, kb.product_recommendations to service_role;

insert into kb.guide_enrichments (locale, area_hint, focus_code, severity, surface_hint, summary, safety_note) values
  ('ko-KR', 'bathroom', 'mold', 'heavy', 'ceramic_tile', '사진에서 보이는 넓거나 반복된 곰팡이 추정 흔적은 작은 구역만 무리 없이 다루고, 환기·보호구·제품 라벨 순서를 먼저 지키는 경로예요.', '넓게 번졌거나 표면 손상·지속적인 습기가 보이면 작업을 멈추고 전문 도움을 고려하세요.'),
  ('ko-KR', 'bathroom', 'mold', 'unknown', 'unknown', '욕실 곰팡이 추정 흔적은 환기와 보호구를 먼저 준비하고, 물로 헹굴 수 있는 단단한 표면에만 제품 라벨 기준으로 진행하는 경로예요.', '염소계 제품은 식초·구연산·산성세제·암모니아·알코올 및 다른 세정제와 절대 섞지 마세요.'),
  ('ko-KR', 'bathroom', 'water_scale', 'moderate', 'ceramic_tile', '타일·도기 표면의 물때 추정 흔적은 제품 라벨과 표면 제조사 안내를 확인한 뒤 작은 구역부터 닦고 충분히 헹구는 경로예요.', '천연석·코팅·재질을 확인할 수 없는 표면에는 산성 제품을 바로 사용하지 마세요.'),
  ('ko-KR', 'bathroom', 'soap_scum', 'unknown', 'hard_surface', '욕실의 비누막 추정 흔적은 환기 후 부드러운 도구로 작은 면부터 닦아 잔여물을 헹구고 말리는 경로예요.', '표면 변화가 보이거나 미끄러운 바닥이 넓으면 더 문지르지 말고 작업을 나누세요.'),
  ('ko-KR', 'sink', 'grease', 'moderate', 'metal', '싱크대 주변 기름때 추정 흔적은 음식물과 물기를 먼저 비운 뒤 열이 식은 작은 면부터 제품 라벨 기준으로 닦고 헹구는 경로예요.', '가열 중인 표면에는 사용하지 말고, 다른 세정제와 섞지 마세요.'),
  ('ko-KR', 'sink', 'water_scale', 'unknown', 'metal', '수전·싱크대 주변 물때 추정 흔적은 표면 제조사 안내를 확인한 뒤 부드러운 천으로 작은 면부터 닦고 물기를 남기지 않는 경로예요.', '천연석 상판 또는 재질을 알 수 없는 부위에는 산성 제품을 직접 사용하지 마세요.'),
  ('ko-KR', 'bed', 'laundry', 'unknown', 'fabric', '침구·의류는 케어 라벨을 먼저 확인하고, 분리 가능한 것부터 세탁 안내와 제품 라벨에 맞춰 처리하는 경로예요.', '표백제·세제·기타 세정제는 서로 섞지 말고, 라벨에서 허용한 소재와 방법만 사용하세요.'),
  ('ko-KR', 'desk', 'dust', 'unknown', 'wood', '원목 또는 재질이 불확실한 책상은 마른 부드러운 천으로 먼지를 먼저 걷고, 물기나 세정제는 제조사 안내가 확인될 때만 사용하는 경로예요.', '표면이 부풀거나 색이 변하면 즉시 멈추고 젖은 천을 오래 두지 마세요.')
on conflict (locale, area_hint, focus_code, severity, surface_hint) do update set summary = excluded.summary, safety_note = excluded.safety_note, active = true;

insert into kb.product_recommendations (locale, area_hint, focus_code, surface_hint, product_type, product_name, purpose, caution, product_query, image_url, priority) values
  ('ko-KR', 'bathroom', 'mold', 'unknown', '곰팡이 제거제', 'Clorox Tilex Mold & Mildew Remover', '욕실 타일·줄눈의 곰팡이 추정 흔적을 제품 라벨 기준으로 관리할 때 참고해요.', '환기하고 장갑·눈 보호구를 착용하세요. 염소계 제품은 산성세제·식초·구연산·암모니아·알코올과 절대 섞지 마세요.', 'Clorox Tilex Mold Mildew Remover', 'https://m.media-amazon.com/images/I/71KNfYfGTmL._AC_SL1500_.jpg', 10),
  ('ko-KR', 'bathroom', 'mold', 'unknown', '욕실 청소도구', 'Scotch-Brite Non-Scratch Scrub Sponge', '단단한 욕실 표면을 작은 범위에서 부드럽게 닦을 때 참고해요.', '천연석·코팅 표면은 제조사 안내를 먼저 확인하고 눈에 띄지 않는 곳에서 확인하세요.', 'Scotch-Brite Non Scratch Scrub Sponge', 'https://m.media-amazon.com/images/I/81Bq-KdfFfL._AC_SL1500_.jpg', 20),
  ('ko-KR', 'bathroom', 'water_scale', 'unknown', '물때 제거용 욕실 클리너', 'The Pink Stuff Miracle Bathroom Foam Cleaner', '수전·타일 주변의 물때와 비누막을 닦을 때 참고해요.', '제품 라벨과 표면 제조사 안내를 먼저 확인하세요. 천연석에는 적합 여부가 확인될 때만 사용하세요.', 'The Pink Stuff Miracle Bathroom Foam Cleaner', 'https://i5.walmartimages.com/seo/The-Pink-Stuff-Miracle-Bathroom-Foam-Cleaner-24oz_5cbd7ef5-5ae8-4414-8ac0-07db29ddff45.cf9eaf504aeda21cfa54a9584e86af49.jpeg?odnBg=FFFFFF&odnHeight=768&odnWidth=768', 10),
  ('ko-KR', 'bathroom', 'water_scale', 'unknown', '극세사 천', 'Scotch-Brite Microfiber Cloth', '수전과 타일의 물기를 가볍게 닦아낼 때 참고해요.', '천연석은 거친 수세미 대신 부드러운 천을 사용하고 제조사 안내를 우선하세요.', 'Scotch-Brite Microfiber Cloth', 'https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg', 20),
  ('ko-KR', 'sink', 'grease', 'unknown', '기름때 세정제', 'Dawn Platinum Powerwash Dish Spray', '싱크대 주변의 기름기와 조리 뒤 남은 자국을 닦을 때 참고해요.', '제품 라벨과 표면 제조사 안내를 우선하세요. 원목·천연석에는 직접 사용 전 적합 여부를 확인하세요.', 'Dawn Platinum Powerwash Dish Spray', 'https://images.ctfassets.net/cj8g3qewem31/3Wdn1B29bd675dWd7hKK4f/1ca6ae08e86d0043568e124515ddf5fe/Dawn_Powerwash_Dish_Spray_Fresh_Scent_Starter_Kit_16oz_80862786_131312837.jpg', 10),
  ('ko-KR', 'sink', 'grease', 'unknown', '부드러운 수세미', 'Scotch-Brite Non-Scratch Scrub Sponge', '싱크대의 작은 범위를 부드럽게 문지를 때 참고해요.', '코팅·천연석·원목은 거친 수세미를 피하고 표면 제조사 안내를 먼저 확인하세요.', 'Scotch-Brite Non Scratch Scrub Sponge', 'https://m.media-amazon.com/images/I/81Bq-KdfFfL._AC_SL1500_.jpg', 20),
  ('ko-KR', 'sink', 'water_scale', 'unknown', '극세사 천', 'Scotch-Brite Microfiber Cloth', '수전의 물기와 닦은 자국을 마무리할 때 참고해요.', '천연석·원목은 물기를 오래 남기지 말고 부드러운 천으로 가볍게 닦으세요.', 'Scotch-Brite Microfiber Cloth', 'https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg', 10),
  ('ko-KR', 'bed', 'laundry', 'unknown', '돌돌이', 'Scotch-Brite Lint Roller', '침구와 침대 주변의 머리카락·보풀을 가볍게 걷을 때 참고해요.', '패브릭은 강하게 문지르지 말고 의류·침구의 세탁 표시를 먼저 확인하세요.', 'Scotch-Brite Lint Roller', 'https://m.media-amazon.com/images/I/71V3bY0OEaL._AC_SL1500_.jpg', 10),
  ('ko-KR', 'bed', 'laundry', 'fabric', '세탁용 얼룩 제거제', 'OxiClean Max Force Laundry Stain Remover', '세탁 전 눈에 띄는 얼룩을 제품·의류 라벨 기준으로 관리할 때 참고해요.', '의류 케어 라벨과 제품 라벨을 먼저 확인하고 다른 세정제와 섞지 마세요.', 'OxiClean Max Force Laundry Stain Remover', 'https://m.media-amazon.com/images/I/81f6A7o6WL._AC_SL1500_.jpg', 20)
on conflict do nothing;

create or replace function public.resolve_cleaning_guide_enrichment(
  p_locale text,
  p_area_hint text,
  p_cleaning_focus text,
  p_severity text default 'unknown',
  p_surface_hint text default 'unknown'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with selected_guide as (
    select summary, safety_note
    from kb.guide_enrichments
    where active and locale = p_locale and area_hint = p_area_hint and focus_code = p_cleaning_focus
      and severity in (p_severity, 'unknown') and surface_hint in (p_surface_hint, 'unknown')
    order by (severity = p_severity) desc, (surface_hint = p_surface_hint) desc
    limit 1
  ), selected_products as (
    select product_type, product_name, purpose, caution, product_query, image_url
    from kb.product_recommendations
    where active and locale = p_locale and area_hint = p_area_hint and focus_code = p_cleaning_focus
      and surface_hint in (p_surface_hint, 'unknown')
    order by (surface_hint = p_surface_hint) desc, priority asc
    limit 3
  )
  select jsonb_build_object(
    'guide_enrichment', coalesce((select jsonb_build_object('summary', summary, 'safety_note', safety_note) from selected_guide), '{}'::jsonb),
    'recommendations', coalesce((select jsonb_agg(jsonb_build_object('type', product_type, 'name', product_name, 'purpose', purpose, 'caution', caution, 'query', product_query, 'image', image_url)) from selected_products), '[]'::jsonb)
  );
$$;

revoke all on function public.resolve_cleaning_guide_enrichment(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_cleaning_guide_enrichment(text, text, text, text, text) to service_role;

commit;
