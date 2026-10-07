"use client";
import { AnimatePresence, motion } from "framer-motion";

/** Centered modal card with a blurred backdrop and springy entrance. */
export function Sheet({ open, onClose, children, className = "" }: { open: boolean; onClose?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            className={`relative w-full max-w-sm rounded-[28px] border border-line bg-surface p-6 text-ink shadow-soft ${className}`}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
