"use client";

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export default function InfoCard({ icon, title, text }) {
  return (
    <motion.article
      className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6 hover:shadow-md transition-transform hover:-translate-y-0.5"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45 }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-2xl bg-slate-50 border border-slate-200 p-3">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">{title}</h3>
          <p className="mt-1.5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">{text}</p>
        </div>
      </div>
    </motion.article>
  );
}