// GLSL programs and the airliner artwork for the exterior scene, ported
// verbatim from the reference (index.html, SCENE section).

const GLSL_COMMON = `
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float stripeAA(float x, float period, float width, float w){
  w = max(w, 1e-4);
  float x0 = x - 0.5*w, x1 = x + 0.5*w;
  float i0 = floor(x0/period)*width + min(mod(x0, period), width);
  float i1 = floor(x1/period)*width + min(mod(x1, period), width);
  return clamp((i1 - i0)/w, 0.0, 1.0);
}
const vec3 ZEN = vec3(0.742, 0.772, 0.804);
const vec3 HOR = vec3(0.936, 0.945, 0.953);
const vec3 HAZEB = vec3(0.800, 0.815, 0.832);
const vec3 FOGW = vec3(0.955, 0.960, 0.965);
`

export const ENV_VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0); }`

export const ENV_FS = `#version 300 es
precision highp float;
uniform vec2 uPrin; uniform float uF; uniform vec3 uCam; uniform float uTime;
uniform vec2 uSlab; uniform float uBelow; uniform float uFog;
uniform vec4 uTowerRect; uniform vec4 uB2Rect;
out vec4 outColor;
${GLSL_COMMON}
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), u.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = m*p; a *= 0.5; } return s; }
float rectDist(vec2 p, vec4 r){ vec2 c = (r.xy + r.zw)*0.5; vec2 hs = abs(r.zw - r.xy)*0.5; vec2 d = abs(p - c) - hs; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main(){
  vec3 rd = normalize(vec3((gl_FragCoord.xy - uPrin)/uF, 1.0));
  vec3 ro = uCam;
  float tg = -ro.y / min(rd.y, -1e-4);
  vec2 g = ro.xz + rd.xz*tg;
  vec2 fwg = fwidth(g);
  vec3 col;
  if (uBelow < 0.5){
    vec3 sky = mix(HOR, ZEN, pow(clamp(rd.y/0.75, 0.0, 1.0), 0.75));
    vec3 sd = normalize(vec3(0.62, 0.34, 0.70));
    float sun = max(dot(rd, sd), 0.0);
    sky += vec3(1.0, 0.99, 0.965) * (pow(sun, 6.0)*0.16 + pow(sun, 64.0)*0.22);
    col = sky;
    if (rd.y < 0.0){
      float t = (uSlab.y - 70.0 - ro.y) / min(rd.y, -1e-4);
      vec2 q = ro.xz + rd.xz*t;
      float n = fbm(q*0.0011 + vec2(uTime*0.006, 0.0));
      float n2 = fbm(q*0.0042 + vec2(3.1, 7.7));
      vec3 cc = mix(vec3(0.78, 0.81, 0.85), vec3(0.99, 0.992, 0.995), smoothstep(0.30, 0.76, n*0.72 + n2*0.36));
      cc = mix(cc, HOR, 1.0 - exp(-t*0.00009));
      col = mix(cc, sky, smoothstep(-0.012, 0.0, rd.y));
    }
  } else {
    if (rd.y > 0.0){
      float t = (uSlab.x - ro.y) / max(rd.y, 1e-4);
      vec2 q = ro.xz + rd.xz*t;
      float n = fbm(q*0.0010 + vec2(uTime*0.006, 0.0));
      float n2 = fbm(q*0.0036 + vec2(7.3, 1.9));
      vec3 cc = mix(vec3(0.615, 0.645, 0.68), vec3(0.815, 0.832, 0.852), smoothstep(0.26, 0.80, n*0.7 + n2*0.4));
      col = mix(cc, HAZEB, 1.0 - exp(-t*0.00016));
    } else {
      float joint = max(stripeAA(g.x, 12.0, 0.35, fwg.x), stripeAA(g.y, 12.0, 0.35, fwg.y));
      float tint = h21(floor(g/12.0)) * 0.035;
      tint = mix(tint, 0.0175, smoothstep(2.0, 6.0, max(fwg.x, fwg.y)));
      vec3 pav = vec3(0.80, 0.81, 0.822) - tint;
      pav = mix(pav, vec3(0.70, 0.71, 0.725), joint*0.75);
      float dT = rectDist(g, uTowerRect);
      float dB = rectDist(g, uB2Rect);
      pav *= mix(0.70, 1.0, smoothstep(0.0, 42.0, dT)) * mix(0.80, 1.0, smoothstep(0.0, 34.0, dB));
      col = mix(pav, HAZEB, 1.0 - exp(-tg*0.00030));
    }
  }
  col = mix(col, FOGW, uFog);
  outColor = vec4(col, 1.0);
}`

export const BLD_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in vec2 aMat;
uniform mat4 uProj; uniform vec3 uCam;
out vec3 vPos; out vec3 vN; out vec2 vUV; flat out float vMatId; out float vFaceW;
void main(){ vPos = aPos; vN = aNrm; vUV = aUV; vMatId = aMat.x; vFaceW = aMat.y; gl_Position = uProj * vec4(aPos - uCam, 1.0); }`

export const BLD_FS = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vN; in vec2 vUV; flat in float vMatId; in float vFaceW;
uniform vec3 uCam; uniform vec2 uSlab; uniform float uBelow; uniform float uFog; uniform float uDoor; uniform float uGlow;
out vec4 outColor;
${GLSL_COMMON}
const vec3 CLOUDW = vec3(0.975, 0.978, 0.982);
const vec3 CEIL = vec3(0.70, 0.725, 0.752);
vec3 lobby(vec2 p, vec2 fw, float glow){
  vec3 wall = vec3(0.958, 0.960, 0.964);
  float cols = stripeAA(p.x + 405.0, 9.0, 7.0, fw.x);
  float band = smoothstep(2.0, 2.0 + fw.y, p.y) * (1.0 - smoothstep(24.0, 24.0 + fw.y, p.y));
  float rows = stripeAA(p.y + 110.0, 5.5, 0.5, fw.y);
  vec3 cab = mix(vec3(0.865, 0.875, 0.89), vec3(0.72, 0.74, 0.765), rows);
  vec3 c = mix(wall, cab, cols*band);
  c = mix(c, vec3(0.90, 0.905, 0.91), 1.0 - smoothstep(1.5, 2.0, p.y));
  c = mix(c, vec3(1.0), smoothstep(27.0, 31.0, p.y)*0.6);
  return mix(c, vec3(1.0), glow);
}
void main(){
  vec2 fw = max(fwidth(vUV), vec2(1e-4));
  int mat = int(vMatId + 0.5);
  if (mat == 3 && uBelow < 0.5) discard;
  float wob = sin(vPos.x * 0.045 + vPos.z * 0.03) * 22.0 + sin(vPos.x * 0.11 - vPos.z * 0.07 + 1.7) * 14.0;
  float occ = uBelow < 0.5 ? smoothstep(uSlab.y - 40.0 + wob, uSlab.y - 210.0 + wob, vPos.y) : smoothstep(uSlab.x - 10.0 + wob, uSlab.x + 60.0 + wob, vPos.y);
  if (occ > 0.995) discard;
  vec3 n = normalize(vN);
  vec3 sd = normalize(vec3(0.62, 0.36, -0.70));
  float diff = max(dot(n, sd), 0.0);
  float lightF = mix(0.70, 0.84, uBelow) + 0.08*n.y + diff*mix(0.42, 0.10, uBelow);
  float u = vUV.x, v = vUV.y;
  vec3 stone = vec3(0.872, 0.876, 0.882);
  vec3 glassA = mix(vec3(0.30, 0.332, 0.368), vec3(0.47, 0.50, 0.535), uBelow);
  vec3 glassB = mix(vec3(0.68, 0.715, 0.75), vec3(0.70, 0.72, 0.745), uBelow);
  vec3 dark = vec3(0.16, 0.17, 0.19);
  vec3 col = stone;
  bool lit = true;
  if (mat == 0){
    float uu = u + 1.7;
    float pier = stripeAA(uu, 15.0, 3.4, fw.x);
    float slab = stripeAA(v, 10.0, 1.8, fw.y);
    float r = h21(floor(vec2(uu/15.0, v/10.0)));
    r = mix(r, 0.5, smoothstep(2.5, 7.0, fw.x));
    vec3 gl = mix(glassA, glassB, 0.16 + 0.44*r);
    gl = mix(gl, glassB, smoothstep(250.0, 1400.0, v) * 0.30 * (1.0 - uBelow));
    col = mix(gl, stone, max(pier, slab));
    col *= 1.0 - 0.12*stripeAA(uu + 3.0, 15.0, 0.6, fw.x);
  } else if (mat == 1){
    float uc = u - vFaceW*0.5;
    float au = abs(uc);
    float bay = stripeAA(au - 45.0 + 360.0, 36.0, 26.0, fw.x) * step(45.0, au);
    float inY = smoothstep(6.0, 6.0 + fw.y, v) * (1.0 - smoothstep(56.0, 56.0 + fw.y, v));
    float open = bay * inY;
    vec3 inside = lobby(vec2(uc*0.8, v - 6.0), fw, 0.0);
    float mull = stripeAA(au + 364.0, 13.0, 0.4, fw.x);
    vec3 glz = mix(inside * 0.94, glassB * 0.9, 0.42);
    glz = mix(glz, glz * 1.08, smoothstep(6.0, 56.0, v));
    glz = mix(glz, dark, mull*0.7);
    glz = mix(glz, dark, stripeAA(v - 42.0 + 100.0, 100.0, 0.5, fw.y));
    vec3 st = stone;
    st = mix(st, stone*0.80, 1.0 - smoothstep(3.0, 3.0 + fw.y, v));
    st = mix(st, stone*0.88, stripeAA(v - 62.0 + 100.0, 100.0, 0.6, fw.y));
    st = mix(st, stone*0.84, stripeAA(v - 56.0 + 100.0, 100.0, 1.2, fw.y) * step(45.0, au));
    float rev = (1.0 - smoothstep(33.0, 33.0 + fw.x, au)) * smoothstep(30.0, 30.0 + fw.x, au) * (1.0 - smoothstep(37.0, 37.0 + fw.y, v));
    st = mix(st, stone*0.72, rev);
    col = mix(st, glz, open);
  } else if (mat == 2){
    float band = stripeAA(v - 16.0 + 120.0, 12.0, 7.0, fw.y);
    float mul = stripeAA(u + 60.0, 5.0, 0.35, fw.x);
    float r = h21(floor(vec2((u + 60.0)/5.0, v/12.0)));
    r = mix(r, 0.5, smoothstep(1.2, 3.5, fw.x));
    vec3 gl = mix(glassA, glassB, 0.22 + 0.36*r);
    col = mix(vec3(0.80, 0.806, 0.815), gl, band);
    col = mix(col, vec3(0.24, 0.26, 0.28), mul*band*0.55);
  } else if (mat == 3){
    float band = stripeAA(v + 90.0, 9.0, 3.6, fw.y);
    col = mix(vec3(0.76, 0.775, 0.79), vec3(0.56, 0.59, 0.62), band*0.8);
  } else if (mat == 4){
    col = stone*0.94;
  } else if (mat == 5){
    float uc = u - vFaceW*0.5;
    float s = uDoor * 27.0;
    float inFrame = step(abs(uc), 27.0) * step(1.2, v) * step(v, 32.8);
    float trans = step(26.5, v);
    float leftLeaf = step(-27.0 - s, uc) * step(uc, -s);
    float rightLeaf = step(s, uc) * step(uc, 27.0 + s);
    float leaf = max(leftLeaf, rightLeaf) * (1.0 - trans);
    vec3 inside = lobby(vec2(uc, v), fw, uGlow);
    vec3 c = mix(inside, mix(inside, glassB, 0.32*(1.0 - uGlow)), max(leaf, trans));
    float e = min(min(abs(uc + s), abs(uc + 27.0 + s)), min(abs(uc - s), abs(uc - 27.0 - s)));
    float stile = (1.0 - smoothstep(0.7, 0.7 + fw.x, e)) * (1.0 - trans);
    c = mix(c, dark, stile);
    float hand = max(1.0 - smoothstep(0.35, 0.35 + fw.x, abs(uc + s + 2.4)), 1.0 - smoothstep(0.35, 0.35 + fw.x, abs(uc - s - 2.4)));
    c = mix(c, vec3(0.12, 0.13, 0.14), hand * step(10.0, v) * step(v, 22.0) * (1.0 - trans));
    c = mix(c, dark, stripeAA(v - 26.5 + 100.0, 100.0, 0.8, fw.y));
    col = mix(dark, c, inFrame);
    lit = false;
  } else if (mat == 6){
    col = vec3(0.19, 0.20, 0.22);
    if (n.y < -0.5){
      vec2 cell = fract(vec2(u, v) / 6.0) - 0.5;
      float dl = 1.0 - smoothstep(0.08, 0.15, length(cell));
      col = mix(vec3(0.30, 0.31, 0.33), vec3(1.0, 0.995, 0.98), dl);
      lit = false;
    }
  } else if (mat == 7){
    float fin = stripeAA(u + 60.0, 6.0, 2.3, fw.x);
    float band = stripeAA(v - 1252.0 + 140.0, 14.0, 1.5, fw.y);
    vec3 glowc = mix(vec3(0.93, 0.935, 0.94), vec3(0.985), smoothstep(1260.0, 1305.0, v));
    col = mix(glowc, stone*lightF, max(fin, band));
    lit = false;
  } else if (mat == 8){
    float uc = u - vFaceW*0.5;
    vec3 inside = lobby(vec2(uc*0.6, v), fw, 0.0);
    float mull = stripeAA(uc + 400.0, 8.0, 0.5, fw.x);
    col = mix(mix(inside, glassB, 0.35), vec3(0.22, 0.23, 0.25), mull*0.8);
    col = mix(col, vec3(0.28, 0.30, 0.32), 1.0 - smoothstep(0.8, 0.8 + fw.y, v));
    col *= mix(1.0, lightF, 0.4);
    lit = false;
  }
  if (lit) col *= lightF;
  if (mat != 5 && mat != 6) col *= mix(0.80, 1.0, smoothstep(0.0, 10.0, vPos.y));
  float d = length(vPos - uCam);
  vec3 haze = mix(HOR, HAZEB, uBelow);
  col = mix(col, haze, 1.0 - exp(-d * mix(0.00011, mat == 3 ? 0.00036 : 0.00026, uBelow)));
  col = mix(col, uBelow < 0.5 ? CLOUDW : CEIL, occ);
  col = mix(col, FOGW, uFog);
  outColor = vec4(col, 1.0);
}`

export const SPR_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 iPos;
layout(location=2) in vec2 iSize;
layout(location=3) in vec4 iMeta; // variant, halfWidth, alpha, layer
uniform mat4 uProj; uniform vec3 uCam; uniform float uTime; uniform float uBelow;
out vec2 vUV; out float vDist; out float vY; out float vAlpha; flat out float vLayer; flat out float vVar;
void main(){
  vec3 p = iPos;
  float hw = iMeta.y;
  p.x = mod(p.x + uTime * (14.0 + iMeta.w * 9.0) + hw, 2.0*hw) - hw;
  float a = iMeta.z * (iMeta.w > 0.5 ? uBelow : 1.0 - uBelow);
  vec3 rel = p - uCam;
  vAlpha = a;
  vDist = length(rel);
  vY = p.y + aCorner.y * iSize.y * 0.5;
  vLayer = iMeta.w; vVar = iMeta.x;
  vUV = vec2(aCorner.x*0.5 + 0.5, 0.5 - aCorner.y*0.5);
  if (a < 0.002 || rel.z < 8.0){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  rel.xy += aCorner * iSize * 0.5;
  gl_Position = uProj * vec4(rel, 1.0);
}`

export const SPR_FS = `#version 300 es
precision highp float;
in vec2 vUV; in float vDist; in float vY; in float vAlpha; flat in float vLayer; flat in float vVar;
uniform sampler2D uTex; uniform float uBelow; uniform float uFog;
out vec4 outColor;
${GLSL_COMMON}
void main(){
  float var = floor(vVar + 0.5);
  vec2 cell = vec2(mod(var, 4.0), floor(var / 4.0));
  vec4 t = texture(uTex, (cell + clamp(vUV, 0.004, 0.996)) / vec2(4.0, 2.0));
  float lit = t.r;
  vec3 c;
  if (vLayer < 0.5){
    c = mix(vec3(0.70, 0.745, 0.80), vec3(1.0), smoothstep(0.05, 0.95, lit));
    c *= mix(0.80, 1.0, clamp((vY - 690.0)/230.0, 0.0, 1.0));
  } else {
    c = mix(vec3(0.60, 0.63, 0.67), vec3(0.79, 0.81, 0.835), lit);
  }
  vec3 haze = mix(HOR, HAZEB, uBelow);
  c = mix(c, haze, 1.0 - exp(-vDist*0.000095));
  float a = t.a * vAlpha * smoothstep(70.0, 420.0, vDist);
  c = mix(c, FOGW, uFog);
  outColor = vec4(c*a, a);
}`

export const PLN_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uProj; uniform vec3 uCam; uniform vec3 uCenter; uniform vec2 uSize;
out vec2 vUV; out float vDist;
void main(){
  vec3 p = uCenter + vec3(aCorner * uSize * 0.5, 0.0);
  vUV = vec2(aCorner.x*0.5 + 0.5, 0.5 - aCorner.y*0.5);
  vDist = length(p - uCam);
  gl_Position = uProj * vec4(p - uCam, 1.0);
}`

export const PLN_FS = `#version 300 es
precision highp float;
in vec2 vUV; in float vDist;
uniform sampler2D uTex; uniform int uMode; uniform float uAlpha;
out vec4 outColor;
void main(){
  vec4 c;
  if (uMode == 0){ c = texture(uTex, vUV); }
  else {
    float across = abs(vUV.y - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.1, 1.0, across)) * smoothstep(0.0, 0.9, vUV.x) * (1.0 - smoothstep(0.985, 1.0, vUV.x)) * 0.6;
    c = vec4(vec3(0.995) * a, a);
  }
  c *= uAlpha;
  float fa = (1.0 - exp(-vDist * 0.00011)) * 0.5;
  c.rgb = mix(c.rgb, vec3(0.936, 0.945, 0.953) * c.a, fa);
  outColor = c;
}`

export const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="1024" height="256">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#666c73"/><stop offset=".42" stop-color="#40454b"/><stop offset="1" stop-color="#2a2e33"/></linearGradient></defs>
<path d="M72 44 L42 9 Q38 5 33 5 L25 5 L41 44 Z" fill="url(#b)"/>
<path d="M24 43 Q30 40 46 40 L352 40 Q381 40 393 50 Q395 54 390 57 Q382 61 356 62 L66 62 Q42 61 30 53 Q21 47 24 43 Z" fill="url(#b)"/>
<path d="M60 49 L20 56 L25 59 L68 53 Z" fill="#31363b"/>
<path d="M240 55 L166 77 Q161 79 156 77 L198 55 Z" fill="#2b2f34"/>
<rect x="208" y="62" width="46" height="13" rx="6.5" fill="#25292d"/>
<g fill="#1d2024">${Array.from({ length: 30 }, (_, i) => `<circle cx="${102 + i * 8}" cy="47.5" r="1.4"/>`).join('')}</g>
<path d="M372 45.5 L382 45.5 L386.5 49.5 L374 49.5 Z" fill="#1d2024"/>
<path d="M60 41.6 L352 41.6" stroke="#9aa1a8" stroke-width="1.1" opacity=".55"/>
</svg>`
