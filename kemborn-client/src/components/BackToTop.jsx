import React, { useState, useEffect } from 'react';
import { FiChevronUp } from 'react-icons/fi';

const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    window.addEventListener('scroll', () => setIsVisible(window.scrollY > 300));
  }, []);
  return isVisible && (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-8 right-8 bg-zinc-900 text-white p-4 rounded-full shadow-xl hover:bg-cyan-600 z-50">
      <FiChevronUp size={24} />
    </button>
  );
};
export default BackToTop;