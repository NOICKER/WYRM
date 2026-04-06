import React from "react";

interface ScreenErrorProps {
  message: string;
}

export function ScreenError({ message }: ScreenErrorProps): React.JSX.Element {
  return (
    <div className="screen-error" role="alert">
      <p>{message}</p>
    </div>
  );
}
