"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Logo({ size = "medium", className = "" }) {
  const [animateLogo, setAnimateLogo] = useState(false);
  const [hoverLogo, setHoverLogo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateLogo(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const sizeClasses = {
    small: "h-8 md:h-10",
    medium: "h-10 md:h-14",
    large: "h-14 md:h-16",
  };

  return (
    <motion.div
      animate={{ y: hoverLogo ? -2 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative flex items-center justify-center h-full px-2 cursor-pointer ${className}`}
      onMouseEnter={() => setHoverLogo(true)}
      onMouseLeave={() => setHoverLogo(false)}
    >
      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        animate={{ opacity: hoverLogo ? 0.8 : 0, scale: hoverLogo ? 1.1 : 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{
          background:
            "radial-gradient(circle, rgba(100,150,200,0.4) 0%, rgba(100,150,200,0) 80%)",
          filter: "blur(20px)",
        }}
      />

      {/* SVG Logo */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 399.39642 101.43724"
        className={`block w-auto overflow-visible ${sizeClasses[size]} ${
          animateLogo ? "animate" : ""
        }`}
      >
        <g id="g1" transform="translate(-50.020566,-198.63523)">
          <g id="g4">
            {/* P */}
            <g id="logo-p" style={{ fill: "#000000", transformOrigin: "center" }}>
              <path d="m 92.393149,253.81155 c 2.031802,-0.96728 3.574669,-2.64479 10.454821,-2.62057 10.27964,0.0362 11.65906,0.0484 15.16292,-3.80921 3.06543,-3.37492 4.34395,-9.58668 2.04521,-13.52404 -2.77758,-4.75754 -6.7642,-5.78501 -15.44524,-5.88109 -5.489426,-0.0608 -9.597305,0.32786 -13.219586,1.64762 -4.597509,1.67508 -5.813858,5.12906 -6.763556,9.99166 -1.481619,7.58611 -4.929354,23.44351 -3.805149,22.93393 3.534301,-1.60203 8.398409,-7.22811 11.57058,-8.7383 z M 52.42432,296.74084 c -4.182535,-5.10148 -1.983938,-11.76351 -0.292654,-19.78844 2.46684,-11.70485 6.054984,-37.12319 10.363546,-55.28736 1.636958,-6.90114 7.044818,-15.0305 14.043122,-18.05923 6.001131,-2.59717 12.133044,-3.78963 18.393648,-3.68905 10.397418,0.16704 21.479238,-1.64166 30.915258,2.58934 6.44346,2.88917 12.14099,8.30281 15.36322,14.58634 3.96312,7.7283 4.6922,17.20515 3.54165,25.81382 -0.86026,6.43661 -3.58112,12.8458 -7.62368,17.92789 -4.221,5.30641 -10.20142,9.33193 -16.44903,11.96673 -9.71658,4.09776 -22.262256,-0.72998 -31.18391,5.32873 -9.29759,6.31401 -15.732823,18.31448 -26.750576,20.83374 -3.430526,0.78441 -8.089444,0.49884 -10.320594,-2.22251 z" />
            </g>

            {/* EAK */}
            <g id="logo-eak" style={{ fill: "#000000", opacity: 1 }}>
              <g id="letter-e">
                <path d="m 285.04487,198.8605 31.00331,0.0485 c 5.45135,32.64082 17.20288,100.71039 17.20288,100.71039 l -28.49822,0.31536 -1.8453,-15.9714 h -37.0176 c -2.68155,5.33333 -5.36309,10.66667 -8.04464,16 h -28.02904 c 17.82869,-33.02983 37.01609,-68.28203 55.22861,-101.10285 z m 15.88346,63.95569 c 0,0 -3.59011,-23.44721 -5.68749,-34.01552 -4.48756,9.01301 -19.23232,33.77746 -19.23232,33.77746 z" />
              </g>
              <g id="letter-a">
                <path d="m 153.9574,276.71335 c 5.29266,-25.21192 11.21792,-52.32318 16.33047,-77.57195 l 34.841,-0.0857 34.841,-0.0857 c -0.97019,7.43347 -2.708,16.68337 -4.31925,23.99333 h -43.70591 l -3.33271,16 c 13.43854,0.0974 26.87665,0.24415 40.31486,0.36125 -1.60793,7.36628 -3.16705,14.74274 -4.63264,22.13875 l -40.39887,0.54132 c 0.0602,0.0491 -3.02773,16.9587 -3.02773,16.9587 h 45.83879 c 0,0 -4.1067,20.876 -4.01949,21 h -73.55333 c 1.60794,-7.75 3.21587,-15.5 4.82381,-23.25 z" />
              </g>
              <g id="letter-k">
                <path d="m 342.41744,293.71335 c 5.97312,-29.20648 11.21734,-61.22366 17.3788,-90.38405 1.41712,-6.12845 8.03786,-4.16664 12.75986,-4.53499 l 16.73764,0.10845 c -2.89118,13.47948 -6.66653,29.08434 -9.57295,42.56059 13.10659,-13.5 26.40489,-29.30062 39.51148,-42.80062 l 30.18473,-0.0275 c 0,0 -30.22656,32.50688 -45.39853,47.59625 8.8499,17.71775 18.49343,35.24412 26.84915,53.08105 -3.63538,1.51731 -10.08746,0.21792 -14.80725,0.65082 h -15.81009 c -5.91341,-12.37204 -11.82681,-24.74409 -17.74021,-37.11613 -3.90041,4.49244 -8.56856,8.28672 -9.97498,14.414 -1.50178,7.57304 -3.4052,15.10398 -4.66747,22.70213 h -26.80205 c 0.45062,-2.08333 0.90125,-4.16667 1.35187,-6.25 z" />
              </g>
            </g>
          </g>
        </g>
      </svg>

      {/* Animations */}
      <style jsx>{`
        #logo-p,
        #logo-eak g {
          opacity: 0;
          transform: scale(0.8);
          transform-box: fill-box;
          transform-origin: center;
        }

        .animate #logo-p {
          animation: dropIn 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .animate #letter-e {
          animation: slideFadeScale 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards 0.6s;
        }
        .animate #letter-a {
          animation: slideFadeScale 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards 1.0s;
        }
        .animate #letter-k {
          animation: slideFadeScale 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards 1.4s;
        }

        @keyframes dropIn {
          0% {
            transform: translateY(-50px) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: translateY(5px) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes slideFadeScale {
          0% {
            transform: translateX(-30px) scale(0.8);
            opacity: 0;
          }
          60% {
            transform: translateX(5px) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </motion.div>
  );
}
