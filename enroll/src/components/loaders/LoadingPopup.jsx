import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import './loading.css'

export const LoadingPopup = ({ show, message = "Loading...", Loader, color = "#ffffff" }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="loading-content">
            {Loader && <Loader color={color} size={12} />}
            <p style={{color:"#fff"}}>{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
