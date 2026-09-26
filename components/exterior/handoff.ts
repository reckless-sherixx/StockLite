// Module state that survives client-side navigations (not full loads), used
// to hand the choreography between the exterior (/) and the interior shell:
//   'exit'  the interior faded the glow in and pushed '/': the exterior mounts
//           at the end of the descent and plays Scene.flyOut.
// A fresh full load of '/' always starts with null (veil + hero intro).
export const handoff: { exit: boolean } = { exit: false }
