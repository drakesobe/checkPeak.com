"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";

export default function NavBar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(null);
  const [animateLogo, setAnimateLogo] = useState(false);
  const [hoverLogo, setHoverLogo] = useState(false);

  const tabs = [
    { name: "Scan", href: "/ocr" },
    { name: "Search", href: "/" },
    { name: "Info", href: "/info" },
    { name: "Blogs", href: "/blogs" },
  ];

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateLogo(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <nav className="bg-white/90 backdrop-blur-md shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center h-24">
          {/* Logo container */}
          <motion.div
            className="flex-shrink-0 relative flex items-center cursor-pointer h-full"
            onMouseEnter={() => setHoverLogo(true)}
            onMouseLeave={() => setHoverLogo(false)}
            animate={{ y: hoverLogo ? -5 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Glow background */}
            <motion.div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              animate={{
                opacity: hoverLogo ? 0.9 : 0,
                scale: hoverLogo ? 1.15 : 1,
              }}
              transition={{
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1],
              }}
              style={{
                background:
                  "radial-gradient(circle, rgba(100,150,200,0.5) 0%, rgba(100,150,200,0) 80%)",
                filter: "blur(28px)", // slightly lighter and softer glow
              }}
            />

            {/* Logo animation styling */}
            <style jsx>{`
              #logo-p,
              #logo-eak {
                transition: none;
                opacity: 0;
              }
              .animate #logo-p {
                animation: dropIn 2s ease forwards;
              }
              .animate #logo-eak {
                animation: slideIn 2.3s ease 0.5s forwards;
              }
              @keyframes dropIn {
                0% {
                  transform: translateY(-50px);
                  opacity: 0;
                }
                60% {
                  transform: translateY(5px);
                  opacity: 1;
                }
                100% {
                  transform: translateY(0);
                  opacity: 1;
                }
              }
              @keyframes slideIn {
                0% {
                  transform: translateX(-50px);
                  opacity: 0;
                }
                100% {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
            `}</style>

            {/* Logo SVG */}
            <svg
              id="peak-logo"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 550 400"
              className={`block h-20 md:h-24 w-auto overflow-visible ${
                animateLogo ? "animate" : ""
              }`}
            >
              {/* P */}
              <g id="logo-p" fill="#000000">
                <path d="m 92.393149,253.81155 c 2.031802,-0.96728 3.574669,-2.64479 10.454821,-2.62057 10.27964,0.0362 11.65906,0.0484 15.16292,-3.80921 3.06543,-3.37492 4.34395,-9.58668 2.04521,-13.52404 -2.77758,-4.75754 -6.7642,-5.78501 -15.44524,-5.88109 -5.489426,-0.0608 -9.597305,0.32786 -13.219586,1.64762 -4.597509,1.67508 -5.813858,5.12906 -6.763556,9.99166 -1.481619,7.58611 -4.929354,23.44351 -3.805149,22.93393 3.534301,-1.60203 8.398409,-7.22811 11.57058,-8.7383 z M 52.42432,296.74084 c -4.182535,-5.10148 -1.983938,-11.76351 -0.292654,-19.78844 2.46684,-11.70485 6.054984,-37.12319 10.363546,-55.28736 1.636958,-6.90114 7.044818,-15.0305 14.043122,-18.05923 6.001131,-2.59717 12.133044,-3.78963 18.393648,-3.68905 10.397418,0.16704 21.479238,-1.64166 30.915258,2.58934 6.44346,2.88917 12.14099,8.30281 15.36322,14.58634 3.96312,7.7283 4.6922,17.20515 3.54165,25.81382 -0.86026,6.43661 -3.58112,12.8458 -7.62368,17.92789 -4.221,5.30641 -10.20142,9.33193 -16.44903,11.96673 -9.71658,4.09776 -22.262256,-0.72998 -31.18391,5.32873 -9.29759,6.31401 -15.732823,18.31448 -26.750576,20.83374 -3.430526,0.78441 -8.089444,0.49884 -10.320594,-2.22251 z" />
              </g>

              {/* EAK */}
              <g id="logo-eak" fill="#000000">
                <path d="m 342.41744,293.71335 c 5.97312,-29.20648 11.21734,-61.22366 17.3788,-90.38405 1.41712,-6.12845 8.03786,-4.16664 12.75986,-4.53499 l 16.73764,0.10845 c -2.89118,13.47948 -6.66653,29.08434 -9.57295,42.56059 13.10659,-13.5 26.40489,-29.30062 39.51148,-42.80062 l 30.18473,-0.0275 c 0,0 -30.22656,32.50688 -45.39853,47.59625 8.8499,17.71775 18.49343,35.24412 26.84915,53.08105 -3.63538,1.51731 -10.08746,0.21792 -14.80725,0.65082 h -15.81009 c -5.91341,-12.37204 -11.82681,-24.74409 -17.74021,-37.11613 -3.90041,4.49244 -8.56856,8.28672 -9.97498,14.414 -1.50178,7.57304 -3.4052,15.10398 -4.66747,22.70213 h -26.80205 c 0.45062,-2.08333 0.90125,-4.16667 1.35187,-6.25 z" />
                <path d="m 285.04487,198.8605 31.00331,0.0485 c 5.45135,32.64082 17.20288,100.71039 17.20288,100.71039 l -28.49822,0.31536 -1.8453,-15.9714 h -37.0176 c -2.68155,5.33333 -5.36309,10.66667 -8.04464,16 h -28.02904 c 17.82869,-33.02983 37.01609,-68.28203 55.22861,-101.10285 z m 15.88346,63.95569 c 0,0 -3.59011,-23.44721 -5.68749,-34.01552 -4.48756,9.01301 -19.23232,33.77746 -19.23232,33.77746 z" />
                <path d="m 153.9574,276.71335 c 5.29266,-25.21192 11.21792,-52.32318 16.33047,-77.57195 l 34.841,-0.0857 34.841,-0.0857 c -0.97019,7.43347 -2.708,16.68337 -4.31925,23.99333 h -43.70591 l -3.33271,16 c 13.43854,0.0974 26.87665,0.24415 40.31486,0.36125 -1.60793,7.36628 -3.16705,14.74274 -4.63264,22.13875 l -40.39887,0.54132 c 0.0602,0.0491 -3.02773,16.9587 -3.02773,16.9587 h 45.83879 c 0,0 -4.1067,20.876 -4.01949,21 h -73.55333 c 1.60794,-7.75 3.21587,-15.5 4.82381,-23.25 z" />
              </g>
            </svg>
          </motion.div>

          {/* Desktop menu */}
          <div className="hidden md:flex space-x-6 relative">
            {tabs.map((tab) => {
              const isActive = router.pathname === tab.href;
              const showUnderline = isActive || hoveredTab === tab.name;
              return (
                <Link key={tab.name} href={tab.href} legacyBehavior>
                  <a
                    onMouseEnter={() => setHoveredTab(tab.name)}
                    onMouseLeave={() => setHoveredTab(null)}
                    className="relative px-4 py-2 rounded-2xl font-medium text-gray-700 hover:text-[#46769B] transition transform hover:scale-102"
                  >
                    {tab.name}
                    {showUnderline && (
                      <motion.span
                        layoutId="underline"
                        className="absolute left-0 bottom-0 w-full h-1 bg-[#46769B] rounded-full shadow-[0_0_4px_#46769B33]"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                      />
                    )}
                  </a>
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="flex flex-col justify-center items-center w-10 h-10 focus:outline-none"
            >
              <span
                className={`block w-6 h-0.5 bg-gray-700 mb-1 rounded transform transition duration-300 ${
                  menuOpen ? "rotate-45 translate-y-1.5" : ""
                }`}
              />
              <span
                className={`block w-6 h-0.5 bg-gray-700 mb-1 rounded transition-opacity duration-300 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block w-6 h-0.5 bg-gray-700 rounded transform transition duration-300 ${
                  menuOpen ? "-rotate-45 -translate-y-1.5" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-white border-t border-gray-200 shadow-md"
          >
            {tabs.map((tab) => {
              const isActive = router.pathname === tab.href;
              return (
                <Link key={tab.name} href={tab.href} legacyBehavior>
                  <a
                    onClick={() => setMenuOpen(false)}
                    className={`block px-6 py-4 font-medium text-gray-700 hover:text-[#46769B] ${
                      isActive ? "bg-blue-50 text-[#46769B]" : ""
                    }`}
                  >
                    {tab.name}
                  </a>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
