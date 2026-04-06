import React from "react";

interface RouteCrossfadeProps {
  routeKey: string;
  children: React.ReactNode;
}

export function RouteCrossfade({
  routeKey,
  children,
}: RouteCrossfadeProps): React.JSX.Element {
  return (
    <div className="route-crossfade">
      <div
        key={routeKey}
        className="route-crossfade__layer route-crossfade__layer--current route-crossfade__layer--entering"
      >
        {children}
      </div>
    </div>
  );
}
