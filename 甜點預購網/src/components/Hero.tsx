import React from 'react'

export const Hero: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-cake-yellow via-cake-light-pink to-cake-peach py-20 text-center border-b-4 border-dashed border-cake-accent rounded-b-3xl shadow-lg relative">
      {/* 社群媒體連結 */}
      <div className="absolute top-6 right-6 flex gap-4">
        <a href="#" className="text-cake-accent text-2xl hover:scale-110 transition-transform">
          <i className="fab fa-line"></i>
        </a>
        <a href="#" className="text-cake-accent text-2xl hover:scale-110 transition-transform">
          <i className="fab fa-facebook"></i>
        </a>
        <a href="#" className="text-cake-accent text-2xl hover:scale-110 transition-transform">
          <i className="fab fa-instagram"></i>
        </a>
      </div>

      <h1 className="text-4xl md:text-5xl font-bold text-cake-accent mb-3">
        💖 安安果子坊
      </h1>
      <p className="text-lg md:text-xl text-cake-coffee opacity-90">
        手作的溫度，藏在每一口甜蜜的驚喜裡。
      </p>
    </div>
  )
}
