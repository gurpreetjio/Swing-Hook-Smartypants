import React from 'react';
import { Circle, G, Line } from 'react-native-svg';
import { Skin } from '../data/cosmetics';

/**
 * The "Doodle" — our round glow-headed swinger. Drawn in local coords with the
 * head at (0,0); pass position/rotation via the parent transform. `pose` swaps
 * between arms-up (hooked), freefall, and `ball` — the tucked bouncy-ball form
 * used whenever the player is off the rope in-game.
 */
export function DoodleFigure({
  skin,
  pose,
  scale = 1,
}: {
  skin: Skin;
  pose: 'hooked' | 'fly' | 'ball';
  scale?: number;
}) {
  const body = skin.body;
  const armUp = pose === 'hooked';
  if (pose === 'ball') {
    return (
      <G scale={scale}>
        {skin.glow ? <Circle cx={0} cy={14} r={30} fill={skin.glow} opacity={0.22} /> : null}
        <Circle cx={0} cy={14} r={16} fill={skin.head} />
        <Circle cx={0} cy={14} r={16} fill="none" stroke={body} strokeWidth={3} opacity={0.65} />
        <Circle cx={-5} cy={11} r={2.3} fill="#10123a" />
        <Circle cx={5} cy={11} r={2.3} fill="#10123a" />
      </G>
    );
  }
  return (
    <G scale={scale}>
      {skin.glow ? <Circle cx={0} cy={6} r={30} fill={skin.glow} opacity={0.22} /> : null}
      {/* body */}
      <Line x1={0} y1={11} x2={0} y2={32} stroke={body} strokeWidth={5} strokeLinecap="round" />
      {/* arms */}
      {armUp ? (
        <>
          <Line x1={0} y1={16} x2={-9} y2={2} stroke={body} strokeWidth={4.5} strokeLinecap="round" />
          <Line x1={0} y1={16} x2={10} y2={-2} stroke={body} strokeWidth={4.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Line x1={0} y1={16} x2={-12} y2={24} stroke={body} strokeWidth={4.5} strokeLinecap="round" />
          <Line x1={0} y1={16} x2={12} y2={22} stroke={body} strokeWidth={4.5} strokeLinecap="round" />
        </>
      )}
      {/* legs */}
      <Line x1={0} y1={32} x2={-9} y2={armUp ? 46 : 42} stroke={body} strokeWidth={4.5} strokeLinecap="round" />
      <Line x1={0} y1={32} x2={9} y2={armUp ? 44 : 46} stroke={body} strokeWidth={4.5} strokeLinecap="round" />
      {/* head */}
      <Circle cx={0} cy={0} r={13} fill={skin.head} />
      <Circle cx={-4} cy={-2} r={2.1} fill="#10123a" />
      <Circle cx={4} cy={-2} r={2.1} fill="#10123a" />
    </G>
  );
}
