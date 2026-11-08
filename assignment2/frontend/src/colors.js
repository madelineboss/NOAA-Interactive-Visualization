// Shared color rules, used by the seasonal chart and (in step 4) the map.

export const WARM = "#e34948";      // red
export const COOL = "#2a78d6";      // blue
export const NEUTRAL = "#f0efec";   // gray midpoint
export const TEXT2 = "#52514e";     // secondary text

// What a POSITIVE anomaly means for each variable, and which color it gets.
// More rain or more frost is "blue"; warmer or more hot days is "red".
export const POLARITY = {
  tavg:       { pos: "Warmer than normal", neg: "Cooler than normal", posColor: WARM, negColor: COOL },
  tmax:       { pos: "Warmer than normal", neg: "Cooler than normal", posColor: WARM, negColor: COOL },
  tmin:       { pos: "Warmer than normal", neg: "Cooler than normal", posColor: WARM, negColor: COOL },
  hot_days:   { pos: "More hot days",      neg: "Fewer hot days",     posColor: WARM, negColor: COOL },
  frost_days: { pos: "More frost days",    neg: "Fewer frost days",   posColor: COOL, negColor: WARM },
  prcp:       { pos: "Wetter than normal", neg: "Drier than normal",  posColor: COOL, negColor: WARM },
};

export const signed = (v) => (v > 0 ? "+" : "") + v;