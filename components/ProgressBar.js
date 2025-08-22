import { useEffect, useState } from "react";

export default function ProgressBar({ progress }) {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    let interval;
    if (progress > displayProgress) {
      interval = setInterval(() => {
        setDisplayProgress((prev) => {
          const next = prev + (progress - prev) * 0.1;
          return next >= progress ? progress : next;
        });
      }, 20);
    } else {
      setDisplayProgress(progress);
    }
    return () => clearInterval(interval);
  }, [progress, displayProgress]);

  return (
    <div className="w-full h-2 bg-gray-700">
      <div
        className="h-2 bg-blue-500 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${displayProgress}%` }}
      />
    </div>
  );
}
