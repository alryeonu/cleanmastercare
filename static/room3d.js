import * as THREE from "/assets/vendor/three.module.min.js";

const host = document.querySelector("#room3d");
const room = document.querySelector(".care-room");

if (host && room) {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x425563, 10, 20);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 50);
    const cameraTarget = new THREE.Vector3(0, 1.65, -0.8);
    camera.position.set(7.1, 5.1, 8.8);
    camera.lookAt(cameraTarget);

    const colors = {
      mint: 0xd9eee2, cream: 0xfff8df, floor: 0xd5b891, teal: 0x35646b,
      coral: 0xee9b83, yellow: 0xf7df79, green: 0x65a77d, sky: 0xb8e7ea,
      white: 0xfffefa, pink: 0xf5b4a4,
    };
    const material = (color, roughness = 0.82) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
    const box = (name, size, color, position, parent = scene) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
      mesh.name = name;
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const sphere = (name, radius, color, position, scale = [1, 1, 1], parent = scene) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), material(color));
      mesh.name = name;
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const cylinder = (name, radii, height, color, position, parent = scene) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, 24), material(color));
      mesh.name = name;
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const staged = [];
    const stage = (group, key) => {
      group.userData.key = key;
      group.userData.amount = 0;
      group.scale.setScalar(0.001);
      staged.push(group);
      return group;
    };

    // 차분한 빈 방에서 시작한다.
    box("floor", [8.8, 0.18, 7.7], colors.floor, [0, -0.1, -0.35]);
    box("backWall", [8.8, 5.8, 0.16], colors.mint, [0, 2.8, -4.1]);
    box("sideWall", [0.16, 5.8, 7.7], 0xc9e3d7, [-4.32, 2.8, -0.35]);
    for (let i = -3; i <= 3; i += 1) box("floorLine", [0.025, 0.012, 7.3], 0xb99873, [i * 1.18, 0.006, -0.35]);

    // 창문과 진행도에 따라 양옆으로 걷히는 커튼.
    const windowGroup = new THREE.Group();
    windowGroup.position.set(-1.7, 2.7, -3.98);
    scene.add(windowGroup);
    box("windowSky", [3.15, 2.5, 0.08], colors.sky, [0, 0, 0], windowGroup);
    box("windowTop", [3.45, 0.18, 0.16], colors.white, [0, 1.31, 0.06], windowGroup);
    box("windowBottom", [3.45, 0.18, 0.16], colors.white, [0, -1.31, 0.06], windowGroup);
    box("windowLeft", [0.18, 2.75, 0.16], colors.white, [-1.64, 0, 0.06], windowGroup);
    box("windowRight", [0.18, 2.75, 0.16], colors.white, [1.64, 0, 0.06], windowGroup);
    box("windowMidV", [0.11, 2.55, 0.15], colors.white, [0, 0, 0.07], windowGroup);
    box("windowMidH", [3.2, 0.11, 0.15], colors.white, [0, 0, 0.07], windowGroup);
    const sunDisc = sphere("sun", 0.32, colors.yellow, [0.9, 0.66, 0.08], [1, 1, 0.28], windowGroup);
    const rod = cylinder("curtainRod", [0.075, 0.075], 4.5, colors.teal, [-1.7, 4.18, -3.7]);
    rod.rotation.z = Math.PI / 2;
    const curtainMaterial = new THREE.MeshStandardMaterial({ color: colors.coral, roughness: 0.95, side: THREE.DoubleSide });
    const curtainGeometry = new THREE.PlaneGeometry(1.7, 3.2, 9, 1);
    const positions = curtainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) positions.setZ(i, Math.sin((positions.getX(i) + 1) * 7) * 0.07);
    positions.needsUpdate = true;
    curtainGeometry.computeVertexNormals();
    const leftCurtain = new THREE.Mesh(curtainGeometry, curtainMaterial);
    const rightCurtain = new THREE.Mesh(curtainGeometry.clone(), curtainMaterial);
    leftCurtain.position.set(-2.48, 2.52, -3.63);
    rightCurtain.position.set(-0.92, 2.52, -3.63);
    leftCurtain.castShadow = rightCurtain.castShadow = true;
    scene.add(leftCurtain, rightCurtain);

    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffeaa0, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const sunBeam = new THREE.Mesh(new THREE.ConeGeometry(2.55, 6.2, 4, 1, true), beamMaterial);
    sunBeam.position.set(-0.45, 1.65, -1.45);
    sunBeam.rotation.x = -0.92;
    sunBeam.rotation.z = -0.34;
    scene.add(sunBeam);

    // 2단계: 러그.
    const rug = stage(new THREE.Group(), "rug");
    scene.add(rug);
    const rugMesh = cylinder("rug", [1.65, 1.65], 0.07, colors.pink, [0.45, 0.04, 0.45], rug);
    rugMesh.scale.z = 0.62;
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      sphere("rugDot", 0.07, colors.cream, [0.45 + Math.cos(angle) * 1.25, 0.11, 0.45 + Math.sin(angle) * 0.72], [1, 0.3, 1], rug);
    }

    // 생활 돌봄 미션: 침대와 쿠션.
    const bed = stage(new THREE.Group(), "pillow");
    scene.add(bed);
    box("bedBase", [3.3, 0.48, 2.3], colors.teal, [1.85, 0.34, -2.05], bed);
    box("mattress", [3.15, 0.42, 2.14], colors.white, [1.85, 0.78, -2.05], bed);
    box("blanket", [1.68, 0.16, 2.18], 0xb8dfd0, [2.55, 1.03, -2.05], bed);
    const pillow = sphere("pillow", 0.58, colors.yellow, [0.86, 1.06, -2.03], [1.2, 0.42, 0.75], bed);
    pillow.rotation.y = -0.1;

    // 4개 청소 단계: 식물이 자라고, 마지막 단계에서 꽃이 핀다.
    const plant = stage(new THREE.Group(), "plant");
    plant.position.set(-2.95, 0, -2.35);
    scene.add(plant);
    cylinder("pot", [0.46, 0.64], 0.78, colors.coral, [0, 0.4, 0], plant);
    cylinder("stem", [0.045, 0.06], 1.55, colors.green, [0, 1.42, 0], plant);
    const makeLeaf = (x, y, z, rotation) => {
      const leaf = sphere("leaf", 0.34, colors.green, [x, y, z], [0.55, 1.15, 0.32], plant);
      leaf.rotation.z = rotation;
    };
    makeLeaf(-0.24, 1.22, 0, -0.7);
    makeLeaf(0.26, 1.5, 0.02, 0.72);
    makeLeaf(-0.2, 1.82, 0, -0.62);
    makeLeaf(0.18, 2.05, 0.01, 0.58);
    const flowers = new THREE.Group();
    flowers.userData.amount = 0;
    flowers.scale.setScalar(0.001);
    plant.add(flowers);
    [[0, 2.28, 0], [-0.33, 1.92, 0.03], [0.38, 1.72, 0.02]].forEach(([x, y, z], flowerIndex) => {
      const flower = new THREE.Group();
      flower.position.set(x, y, z);
      flowers.add(flower);
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2;
        sphere("petal", 0.13, flowerIndex === 1 ? colors.yellow : colors.pink, [Math.cos(angle) * 0.17, Math.sin(angle) * 0.17, 0], [1, 1, 0.5], flower);
      }
      sphere("flowerCenter", 0.1, colors.yellow, [0, 0, 0.06], [1, 1, 0.55], flower);
    });

    // 욕실 미션 완료: 따뜻한 조명.
    const lampGroup = stage(new THREE.Group(), "lamp");
    lampGroup.position.set(3.35, 0, 0.6);
    scene.add(lampGroup);
    cylinder("lampBase", [0.42, 0.56], 0.12, colors.teal, [0, 0.06, 0], lampGroup);
    cylinder("lampStand", [0.055, 0.065], 1.9, colors.teal, [0, 1, 0], lampGroup);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.7, 0.72, 24, 1, true), material(colors.yellow));
    shade.position.y = 2;
    shade.castShadow = true;
    lampGroup.add(shade);
    const lampGlow = new THREE.PointLight(0xffd875, 0, 4.5, 2);
    lampGlow.position.set(0, 1.75, 0);
    lampGroup.add(lampGlow);

    // 이 방의 거주자는 해금 아이템이 아니라 처음부터 이곳에서 생활한다.
    const resident = new THREE.Group();
    resident.position.set(0.32, 0.84, 0.72);
    scene.add(resident);
    const residentShadow = cylinder("residentShadow", [0.9, 1.05], 0.025, 0x294c50, [0, -0.77, 0], resident);
    residentShadow.scale.z = 0.36;
    residentShadow.material.transparent = true;
    residentShadow.material.opacity = 0.18;
    new THREE.TextureLoader().load("/assets/room-resident.png?v=1", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
      sprite.scale.set(3.15, 2.9, 1);
      sprite.position.y = 0.18;
      resident.add(sprite);
    });

    // 전후 기록: 액자와 만개한 꽃.
    const frame = stage(new THREE.Group(), "frame");
    frame.position.set(2.12, 2.65, -3.88);
    scene.add(frame);
    box("frameOuter", [1.65, 1.25, 0.16], colors.coral, [0, 0, 0], frame);
    box("framePaper", [1.32, 0.92, 0.18], colors.cream, [0, 0, 0.05], frame);
    const heart = new THREE.Group();
    heart.position.set(0, -0.02, 0.18);
    frame.add(heart);
    sphere("heartL", 0.2, colors.coral, [-0.16, 0.1, 0], [1, 1, 0.35], heart);
    sphere("heartR", 0.2, colors.coral, [0.16, 0.1, 0], [1, 1, 0.35], heart);
    const heartTip = box("heartTip", [0.42, 0.42, 0.09], colors.coral, [0, -0.08, 0], heart);
    heartTip.rotation.z = Math.PI / 4;

    const ambient = new THREE.HemisphereLight(0xbcd4ea, 0x344452, 0.65);
    scene.add(ambient);
    const daylight = new THREE.DirectionalLight(0xffe8ae, 0.35);
    daylight.position.set(-4, 7, 4);
    daylight.castShadow = true;
    daylight.shadow.mapSize.set(1024, 1024);
    scene.add(daylight);
    const windowLight = new THREE.SpotLight(0xffdc88, 0, 18, Math.PI / 5, 0.6, 1.2);
    windowLight.position.set(-1.7, 3.6, -3.2);
    windowLight.target.position.set(0.5, 0, 1.5);
    windowLight.castShadow = true;
    scene.add(windowLight, windowLight.target);

    const itemIsUnlocked = (key) => document.querySelector(`[data-room-item="${key}"]`)?.classList.contains("unlocked") || false;
    let targetWarmth = Number(room.dataset.warmth || 0);
    let warmth = targetWarmth;
    let unlocks = {};
    let pointerX = 0;
    let pointerY = 0;
    let visible = true;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    const darkSky = new THREE.Color(0x334958);
    const lightSky = new THREE.Color(0xfff3c5);
    const fogDark = new THREE.Color(0x425563);
    const fogLight = new THREE.Color(0xf3e7bd);
    const background = darkSky.clone();
    scene.background = background;

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();
    host.addEventListener("pointermove", (event) => {
      const rect = host.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    });
    host.addEventListener("pointerleave", () => { pointerX = 0; pointerY = 0; });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.02 }).observe(room);

    const applyState = (state = {}) => {
      targetWarmth = THREE.MathUtils.clamp(Number(state.count ?? room.dataset.warmth ?? 0), 0, 6);
      unlocks = state.unlocked || {
        sunlight: itemIsUnlocked("sunlight"), rug: itemIsUnlocked("rug"), plant: itemIsUnlocked("plant"),
        pillow: itemIsUnlocked("pillow"), lamp: itemIsUnlocked("lamp"), frame: itemIsUnlocked("frame"),
      };
    };
    window.updateLightRoom3D = applyState;
    applyState();

    const animate = () => {
      requestAnimationFrame(animate);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const speed = reducedMotion ? 30 : 2.8;
      warmth = THREE.MathUtils.damp(warmth, targetWarmth, speed, dt);
      const progress = warmth / 6;
      background.copy(darkSky).lerp(lightSky, progress);
      scene.fog.color.copy(fogDark).lerp(fogLight, progress);
      ambient.intensity = 0.58 + progress * 1.12;
      daylight.intensity = 0.24 + progress * 1.85;
      windowLight.intensity = progress * 3.7;
      renderer.toneMappingExposure = 0.72 + progress * 0.38;
      sunDisc.material.emissive.set(colors.yellow);
      sunDisc.material.emissiveIntensity = 0.12 + progress * 1.3;
      beamMaterial.opacity = Math.max(0, (progress - 0.04) * 0.26);

      const open = 0.14 + progress * 0.82;
      leftCurtain.position.x = -1.7 - open * 1.43;
      rightCurtain.position.x = -1.7 + open * 1.43;
      leftCurtain.scale.x = 1 - open * 0.58;
      rightCurtain.scale.x = 1 - open * 0.58;

      staged.forEach((group) => {
        const wanted = unlocks[group.userData.key] ? 1 : 0.001;
        group.userData.amount = THREE.MathUtils.damp(group.userData.amount, wanted, reducedMotion ? 30 : 4.5, dt);
        group.scale.setScalar(Math.max(group.userData.amount, 0.001));
      });
      const bloomTarget = targetWarmth >= 6 ? 1 : 0.001;
      flowers.userData.amount = THREE.MathUtils.damp(flowers.userData.amount, bloomTarget, reducedMotion ? 30 : 3.3, dt);
      flowers.scale.setScalar(Math.max(flowers.userData.amount, 0.001));
      lampGlow.intensity = unlocks.lamp ? 1.9 : 0;

      const elapsed = clock.elapsedTime;
      if (!reducedMotion) resident.position.y = 0.84 + Math.sin(elapsed * 1.35) * 0.025;
      if (targetWarmth >= 6 && !reducedMotion) flowers.rotation.z = Math.sin(elapsed * 0.8) * 0.025;
      const yaw = pointerX * 0.34;
      const pitch = -pointerY * 0.18;
      const radius = 11.3;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(0.67 + yaw) * radius, 3.2, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, Math.cos(0.67 + yaw) * radius - 0.4, 3.2, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 5.1 + pitch, 3.2, dt);
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    };

    room.classList.add("webgl-ready");
    animate();
  } catch (error) {
    console.info("3D room fallback is active.", error);
    room.classList.remove("webgl-ready");
    room.classList.add("css3d-ready");
    room.addEventListener("pointermove", (event) => {
      const rect = room.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      room.style.setProperty("--fallback-rx", `${-y * 2.2}deg`);
      room.style.setProperty("--fallback-ry", `${x * 3.2}deg`);
    });
    room.addEventListener("pointerleave", () => {
      room.style.setProperty("--fallback-rx", "0deg");
      room.style.setProperty("--fallback-ry", "0deg");
    });
  }
}
