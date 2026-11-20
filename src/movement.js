// Convert screen-relative WASD input to a unit direction on the ground plane.
export function footDirection(yaw, forward, strafe) {
  let x=-Math.sin(yaw)*forward+Math.cos(yaw)*strafe;
  let z=-Math.cos(yaw)*forward-Math.sin(yaw)*strafe;
  const length=Math.hypot(x,z);
  if(length){x/=length;z/=length;}
  return {x,z};
}
