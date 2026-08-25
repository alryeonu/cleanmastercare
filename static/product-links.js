/*
 * 상품 정보와 외부 이동 링크는 이 파일에서만 관리합니다.
 * 제휴 링크/API를 연결할 때 query 또는 url만 교체하면 추천 화면은 그대로 유지됩니다.
 */
const PRODUCT_CATALOG = {
  bathroom: {
    mold: [
      { type: "곰팡이 제거제", name: "Clorox Tilex Mold & Mildew Remover", purpose: "욕실 타일·줄눈의 곰팡이 추정 흔적을 닦을 때 참고할 수 있어요.", caution: "환기하고 장갑을 착용하세요. 염소계 제품은 산성세제·식초·구연산·암모니아 제품과 절대 섞지 마세요.", query: "Clorox Tilex Mold Mildew Remover", image: "https://m.media-amazon.com/images/I/71KNfYfGTmL._AC_SL1500_.jpg" },
      { type: "욕실 청소도구", name: "Scotch-Brite Non-Scratch Scrub Sponge", purpose: "단단한 욕실 표면을 부드럽게 문지를 때 참고할 수 있어요.", caution: "천연석·코팅 표면은 먼저 제조사 안내를 확인하고, 눈에 띄지 않는 곳에서 작은 범위만 확인하세요.", query: "Scotch-Brite Non Scratch Scrub Sponge", image: "https://m.media-amazon.com/images/I/81Bq-KdfFfL._AC_SL1500_.jpg" },
    ],
    water_scale: [
      { type: "물때 제거용 욕실 클리너", name: "The Pink Stuff Miracle Bathroom Foam Cleaner", purpose: "수전·타일 주변의 물때와 비누막을 닦을 때 참고할 수 있어요.", caution: "제품 라벨과 표면 제조사 안내를 먼저 확인하세요. 천연석에는 사용 전 반드시 적합 여부를 확인하세요.", query: "The Pink Stuff Miracle Bathroom Foam Cleaner", image: "https://i5.walmartimages.com/seo/The-Pink-Stuff-Miracle-Bathroom-Foam-Cleaner-24oz_5cbd7ef5-5ae8-4414-8ac0-07db29ddff45.cf9eaf504aeda21cfa54a9584e86af49.jpeg?odnBg=FFFFFF&odnHeight=768&odnWidth=768" },
      { type: "부드러운 청소도구", name: "Scotch-Brite Microfiber Cloth", purpose: "수전과 타일의 물기를 가볍게 닦아낼 때 참고할 수 있어요.", caution: "천연석은 거친 수세미 대신 부드러운 천을 사용하고, 표면 제조사 안내를 우선하세요.", query: "Scotch-Brite Microfiber Cloth", image: "https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg" },
    ],
    default: [
      { type: "욕실 청소도구", name: "Scotch-Brite Microfiber Cloth", purpose: "욕실의 작은 범위를 부드럽게 닦을 때 참고할 수 있어요.", caution: "제품 라벨과 표면 제조사 안내를 우선하세요. 천연석은 강한 세정제나 거친 도구를 피하세요.", query: "Scotch-Brite Microfiber Cloth", image: "https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg" },
      { type: "욕실 클리너", name: "The Pink Stuff Miracle Bathroom Foam Cleaner", purpose: "욕실 표면의 일상적인 물때와 비누막을 닦을 때 참고할 수 있어요.", caution: "제품 라벨과 표면 제조사 안내를 우선하세요. 다른 제품과 섞지 마세요.", query: "The Pink Stuff Miracle Bathroom Foam Cleaner", image: "https://i5.walmartimages.com/seo/The-Pink-Stuff-Miracle-Bathroom-Foam-Cleaner-24oz_5cbd7ef5-5ae8-4414-8ac0-07db29ddff45.cf9eaf504aeda21cfa54a9584e86af49.jpeg?odnBg=FFFFFF&odnHeight=768&odnWidth=768" },
    ],
  },
  sink: {
    grease: [
      { type: "기름때 세정제", name: "Dawn Platinum Powerwash Dish Spray", purpose: "싱크대 주변의 기름기와 조리 뒤 남은 자국을 닦을 때 참고할 수 있어요.", caution: "제품 라벨과 표면 제조사 안내를 우선하세요. 원목·천연석에는 직접 사용 전 적합 여부를 확인하세요.", query: "Dawn Platinum Powerwash Dish Spray", image: "https://images.ctfassets.net/cj8g3qewem31/3Wdn1B29bd675dWd7hKK4f/1ca6ae08e86d0043568e124515ddf5fe/Dawn_Powerwash_Dish_Spray_Fresh_Scent_Starter_Kit_16oz_80862786_131312837.jpg" },
      { type: "부드러운 수세미", name: "Scotch-Brite Non-Scratch Scrub Sponge", purpose: "싱크대의 작은 범위를 부드럽게 문지를 때 참고할 수 있어요.", caution: "코팅·천연석·원목은 거친 수세미를 피하고 표면 제조사 안내를 먼저 확인하세요.", query: "Scotch-Brite Non Scratch Scrub Sponge", image: "https://m.media-amazon.com/images/I/81Bq-KdfFfL._AC_SL1500_.jpg" },
    ],
    water_scale: [
      { type: "물때 제거용 클리너", name: "The Pink Stuff Miracle Bathroom Foam Cleaner", purpose: "싱크대 수전 주변의 물때를 닦을 때 참고할 수 있어요.", caution: "천연석에는 사용 전 제품 라벨과 표면 제조사 안내를 확인하세요. 다른 제품과 섞지 마세요.", query: "The Pink Stuff Miracle Bathroom Foam Cleaner", image: "https://i5.walmartimages.com/seo/The-Pink-Stuff-Miracle-Bathroom-Foam-Cleaner-24oz_5cbd7ef5-5ae8-4414-8ac0-07db29ddff45.cf9eaf504aeda21cfa54a9584e86af49.jpeg?odnBg=FFFFFF&odnHeight=768&odnWidth=768" },
      { type: "극세사 천", name: "Scotch-Brite Microfiber Cloth", purpose: "수전의 물기와 닦은 자국을 마무리할 때 참고할 수 있어요.", caution: "천연석·원목은 물기를 오래 남기지 말고 부드러운 천으로 가볍게 닦으세요.", query: "Scotch-Brite Microfiber Cloth", image: "https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg" },
    ],
    default: [
      { type: "주방 기름때 세정제", name: "Dawn Platinum Powerwash Dish Spray", purpose: "싱크대 주변의 일상적인 기름기와 자국을 닦을 때 참고할 수 있어요.", caution: "제품 라벨과 표면 제조사 안내를 우선하세요. 다른 제품과 섞지 마세요.", query: "Dawn Platinum Powerwash Dish Spray", image: "https://images.ctfassets.net/cj8g3qewem31/3Wdn1B29bd675dWd7hKK4f/1ca6ae08e86d0043568e124515ddf5fe/Dawn_Powerwash_Dish_Spray_Fresh_Scent_Starter_Kit_16oz_80862786_131312837.jpg" },
      { type: "부드러운 수세미", name: "Scotch-Brite Non-Scratch Scrub Sponge", purpose: "싱크대의 작은 범위를 부드럽게 정리할 때 참고할 수 있어요.", caution: "코팅·천연석·원목은 거친 수세미를 피하고 표면 제조사 안내를 먼저 확인하세요.", query: "Scotch-Brite Non Scratch Scrub Sponge", image: "https://m.media-amazon.com/images/I/81Bq-KdfFfL._AC_SL1500_.jpg" },
    ],
  },
  fabric: [
    { type: "세탁용 얼룩 제거제", name: "OxiClean Max Force Laundry Stain Remover", purpose: "세탁 전 눈에 띄는 얼룩을 관리할 때 참고할 수 있어요.", caution: "패브릭은 제품 라벨·의류 세탁 표시를 먼저 확인하고, 눈에 띄지 않는 작은 곳에서 확인하세요.", query: "OxiClean Max Force Laundry Stain Remover", image: "https://m.media-amazon.com/images/I/81f6A7o6WwL._AC_SL1500_.jpg" },
    { type: "극세사 천", name: "Scotch-Brite Microfiber Cloth", purpose: "패브릭 표면의 먼지를 가볍게 걷을 때 참고할 수 있어요.", caution: "패브릭은 물기와 강한 세정제를 바로 사용하지 말고 세탁 표시를 우선하세요.", query: "Scotch-Brite Microfiber Cloth", image: "https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg" },
  ],
  default: [
    { type: "극세사 천", name: "Scotch-Brite Microfiber Cloth", purpose: "작은 범위를 부드럽게 닦아낼 때 참고할 수 있어요.", caution: "표면 제조사 안내를 먼저 확인하세요. 원목·천연석·패브릭은 강한 세정제나 거친 도구를 피하세요.", query: "Scotch-Brite Microfiber Cloth", image: "https://m.media-amazon.com/images/I/81KgfQO5RGL._AC_SL1500_.jpg" },
    { type: "부드러운 수세미", name: "Scotch-Brite Non-Scratch Scrub Sponge", purpose: "단단한 표면의 작은 범위를 부드럽게 정리할 때 참고할 수 있어요.", caution: "코팅 표면은 제품 라벨과 표면 제조사 안내를 우선하고, 눈에 띄지 않는 곳에서 먼저 확인하세요.", query: "Scotch-Brite Non Scratch Scrub Sponge", image: "https://m.media-amazon.com/images/I/81Bq-KdfFfL._AC_SL1500_.jpg" },
  ],
};
