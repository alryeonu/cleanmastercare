(() => {
  const room = document.querySelector(".care-room");
  const canvas = document.querySelector("#roomCanvas3d");
  if (!room || !canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 1;
  let height = 1;
  let dpr = 1;
  let targetYaw = -0.27;
  let targetPitch = 0.27;
  let yaw = targetYaw;
  let pitch = targetPitch;
  let targetProgress = Number(room.dataset.warmth || 0);
  let progress = targetProgress;
  let unlocks = {};
  let visible = true;
  const resident = new Image();
  resident.src = "/assets/room-resident.png?v=1";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const unlockedFromDom = (key) => document.querySelector(`[data-room-item="${key}"]`)?.classList.contains("unlocked") || false;
  const applyState = (state = {}) => {
    targetProgress = Math.max(0, Math.min(6, Number(state.count ?? room.dataset.warmth ?? 0)));
    unlocks = state.unlocked || {
      sunlight: unlockedFromDom("sunlight"),
      rug: unlockedFromDom("rug"),
      plant: unlockedFromDom("plant"),
      pillow: unlockedFromDom("pillow"),
      lamp: unlockedFromDom("lamp"),
      frame: unlockedFromDom("frame"),
    };
  };
  window.updateLightRoomCanvas3D = applyState;
  applyState();

  const hex = (value) => {
    const text = value.replace("#", "");
    return [parseInt(text.slice(0, 2), 16), parseInt(text.slice(2, 4), 16), parseInt(text.slice(4, 6), 16)];
  };
  const mix = (a, b, amount) => {
    const aa = hex(a); const bb = hex(b);
    return `rgb(${aa.map((value, index) => Math.round(value + (bb[index] - value) * amount)).join(",")})`;
  };
  const shade = (color, amount) => mix(color, amount > 0 ? "#ffffff" : "#000000", Math.abs(amount));

  const resize = () => {
    const rect = room.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  new ResizeObserver(resize).observe(room);
  resize();

  const project = ([x, y, z]) => {
    const cy = Math.cos(yaw); const sy = Math.sin(yaw);
    const cp = Math.cos(pitch); const sp = Math.sin(pitch);
    const rx = x * cy - z * sy;
    const rz = x * sy + z * cy;
    const ry = y * cp - rz * sp;
    const depth = y * sp + rz * cp;
    const camera = 11.5;
    const focal = Math.min(width, height) * 1.08;
    const scale = focal / Math.max(3.5, camera - depth);
    return { x: width * 0.51 + rx * scale, y: height * 0.52 - ry * scale, depth, scale };
  };

  const faces = [];
  const addFace = (points, color, alpha = 1, stroke = null) => faces.push({ points, color, alpha, stroke });
  const addBox = (x, y, z, w, h, d, color) => {
    const x0 = x - w / 2; const x1 = x + w / 2;
    const y0 = y; const y1 = y + h;
    const z0 = z - d / 2; const z1 = z + d / 2;
    addFace([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], color);
    addFace([[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], shade(color,-.13));
    addFace([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], shade(color,-.2));
    addFace([[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], shade(color,-.08));
    addFace([[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], shade(color,.13));
  };
  const addFloorDisc = (x, z, rx, rz, color, segments = 26) => {
    const points = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([x + Math.cos(angle) * rx, 0.025, z + Math.sin(angle) * rz]);
    }
    addFace(points, color);
  };

  const drawFace = (face) => {
    const projected = face.points.map(project);
    ctx.beginPath();
    projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.globalAlpha = face.alpha;
    ctx.fillStyle = face.color;
    ctx.fill();
    if (face.stroke) { ctx.strokeStyle = face.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.globalAlpha = 1;
  };

  const drawCircle3d = (point, radius, color, alpha = 1) => {
    const p = project(point);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, radius * p.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  const drawLine3d = (from, to, width3d, color) => {
    const a = project(from); const b = project(to);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width3d * (a.scale + b.scale) / 2);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  };

  const draw = () => {
    const light = progress / 6;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, mix("#263946", "#dff2e8", light));
    gradient.addColorStop(1, mix("#485966", "#fff3c4", light));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    faces.length = 0;
    const wall = mix("#70858d", "#dff2e8", light);
    const side = mix("#506975", "#c9e3d7", light);
    const floor = mix("#887a6c", "#e6cba5", light);

    addFace([[-3.8,0,-3.5],[3.8,0,-3.5],[3.8,4.15,-3.5],[-3.8,4.15,-3.5]], wall);
    addFace([[-3.8,0,2.6],[-3.8,0,-3.5],[-3.8,4.15,-3.5],[-3.8,4.15,2.6]], side);
    addFace([[-3.8,0,-3.5],[3.8,0,-3.5],[3.8,0,2.6],[-3.8,0,2.6]], floor);
    for (let x = -3; x <= 3; x += 1) addFace([[x,0.012,-3.5],[x+.025,0.012,-3.5],[x+.025,0.012,2.6],[x,0.012,2.6]], shade(floor,-.08), .5);

    // Window and a real depth-changing sun beam.
    addFace([[-3.05,1.22,-3.47],[-.55,1.22,-3.47],[-.55,3.42,-3.47],[-3.05,3.42,-3.47]], mix("#7595a7", "#bce7eb", light), 1, "#fffefa");
    addBox(-1.8,1.18,-3.3,2.7,.12,.14,"#fffefa");
    addBox(-1.8,3.38,-3.3,2.7,.12,.14,"#fffefa");
    addBox(-3.08,1.18,-3.3,.12,2.3,.14,"#fffefa");
    addBox(-.52,1.18,-3.3,.12,2.3,.14,"#fffefa");
    addBox(-1.8,1.18,-3.24,.09,2.3,.13,"#fffefa");
    addBox(-1.8,2.26,-3.23,2.6,.09,.13,"#fffefa");
    if (light > .08) addFace([[-2.9,.02,-3.05],[-.7,.02,-3.05],[2.45,.02,2.25],[-.25,.02,2.25]],"#ffeaa0",light*.22);

    const open = .18 + light * .82;
    const curtainOffset = 1.36 * open;
    addBox(-1.8-curtainOffset,1.08,-3.05,1.3*(1-open*.54),2.5,.2,"#ee9b83");
    addBox(-1.8+curtainOffset,1.08,-3.05,1.3*(1-open*.54),2.5,.2,"#ee9b83");
    addBox(-1.8,3.65,-3.02,3.2,.08,.1,"#35646b");

    if (unlocks.rug) {
      addFloorDisc(.25,.65,1.65,1.08,"#f3a58f");
      addFloorDisc(.25,.65,1.16,.72,"#fff0c9");
      addFloorDisc(.25,.65,.62,.38,"#f3a58f");
    }
    if (unlocks.pillow) {
      addBox(1.75,.02,-1.45,3.1,.46,2.05,"#35646b");
      addBox(1.75,.48,-1.45,2.98,.4,1.94,"#fffefa");
      addBox(2.38,.88,-1.45,1.62,.15,1.96,"#b8dfd0");
      addBox(.82,.9,-1.45,1.0,.3,.72,"#f7df79");
    }
    if (unlocks.plant) {
      addBox(-2.85,.02,-1.75,.88,.72,.74,"#ee9b83");
      addBox(-2.85,.72,-1.75,.08,1.12,.08,"#4e966e");
    }
    if (unlocks.lamp) {
      addBox(3.05,.02,.35,.78,.11,.6,"#35646b");
      addBox(3.05,.13,.35,.09,1.5,.09,"#35646b");
      addBox(3.05,1.63,.35,1.02,.58,.72,"#f7df79");
    }
    if (unlocks.frame) {
      addBox(2.35,2.35,-3.3,1.42,1.02,.13,"#ee9b83");
      addBox(2.35,2.48,-3.14,1.13,.73,.05,"#fff8df");
    }

    const projectedFaces = faces.map((face) => ({ face, depth: face.points.reduce((sum, point) => sum + project(point).depth, 0) / face.points.length }));
    projectedFaces.sort((a,b) => a.depth - b.depth).forEach(({face}) => drawFace(face));

    if (unlocks.plant) {
      drawLine3d([-2.85,.7,-1.68],[-3.2,1.9,-1.64],.05,"#4e966e");
      drawLine3d([-2.85,.72,-1.68],[-2.48,1.82,-1.64],.05,"#4e966e");
      [[-3.18,1.28],[-2.55,1.18],[-3.22,1.7],[-2.48,1.6],[-2.85,1.98]].forEach(([x,y],i) => drawCircle3d([x,y,-1.58],.22,i%2?"#79bc8c":"#65a77d"));
      if (targetProgress >= 6) [[-3.22,1.88],[-2.48,1.82],[-2.85,2.15]].forEach(([x,y],i) => {
        const flowerColor = i===1 ? "#f7df79" : "#f5b4a4";
        for (let petal=0;petal<5;petal+=1) {
          const a=petal/5*Math.PI*2; drawCircle3d([x+Math.cos(a)*.16,y+Math.sin(a)*.16,-1.48],.105,flowerColor);
        }
        drawCircle3d([x,y,-1.44],.075,"#e5b437");
      });
    }
    if (unlocks.lamp) drawCircle3d([3.05,1.82,.45],.26,"#fff1a9",.28+light*.4);
    if (resident.complete) {
      const p = project([.42,.6,.72]);
      const size = 2.9*p.scale;
      const bob = reducedMotion ? 0 : Math.sin(performance.now() / 820) * 2;
      ctx.save();
      ctx.globalAlpha = .2;
      ctx.fillStyle = "#294c50";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + size * .14, size * .39, size * .085, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowColor = "rgba(24,58,58,.25)"; ctx.shadowBlur = 16;
      ctx.drawImage(resident,p.x-size*.52,p.y-size*.78+bob,size*1.04,size*.96);
      ctx.restore();
    }

  };

  let last = performance.now();
  const animate = (now) => {
    requestAnimationFrame(animate);
    if (!visible) return;
    const delta = Math.min(.05,(now-last)/1000); last=now;
    const ease = 1-Math.exp(-delta*5);
    yaw += (targetYaw-yaw)*ease;
    pitch += (targetPitch-pitch)*ease;
    progress += (targetProgress-progress)*ease;
    draw();
  };

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX-rect.left)/rect.width-.5;
    const y = (event.clientY-rect.top)/rect.height-.5;
    targetYaw = -.27 + x*.42;
    targetPitch = .27 - y*.16;
  });
  canvas.addEventListener("pointerleave", () => { targetYaw=-.27; targetPitch=.27; });
  new IntersectionObserver(([entry]) => { visible=entry.isIntersecting; if (visible) last=performance.now(); },{threshold:.01}).observe(room);
  room.classList.add("software3d-ready");
  requestAnimationFrame(animate);
})();
