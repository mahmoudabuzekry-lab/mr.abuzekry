import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';

interface PrivacyAmountProps {
  amount: number | string;
  suffix?: string;
  prefix?: string;
  className?: string;
  amountClassName?: string;
  initialRevealed?: boolean;
  blurLevel?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

/**
 * Component to display financial amounts with automatic privacy blur.
 * Double-clicking toggles the blur on/off.
 */
export function PrivacyAmount({
  amount,
  suffix = 'ج.م',
  prefix,
  className = '',
  amountClassName = '',
  initialRevealed = false,
  blurLevel = 'md',
  showBadge = false
}: PrivacyAmountProps) {
  const [isRevealed, setIsRevealed] = useState(initialRevealed);

  const blurClass = {
    sm: 'blur-xs',
    md: 'blur-[6px]',
    lg: 'blur-md'
  }[blurLevel];

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRevealed(prev => !prev);
  };

  return (
    <span
      onDoubleClick={handleToggle}
      title={isRevealed ? "انقر مرتين بالماوس لإخفاء المبلغ (حفاظاً على الخصوصية) 🔒" : "انقر مرتين بالماوس لإظهار المبلغ 👁️"}
      className={`inline-flex items-center gap-1.5 cursor-pointer select-none transition-all duration-300 group ${className}`}
    >
      <span
        className={`transition-all duration-300 ${
          isRevealed
            ? 'filter-none opacity-100'
            : `${blurClass} opacity-75 group-hover:opacity-90 select-none`
        } ${amountClassName}`}
      >
        {prefix && <span className="ml-1">{prefix}</span>}
        <span>{typeof amount === 'number' ? amount.toLocaleString('ar-EG') : amount}</span>
        {suffix && <span className="mr-1 text-[0.85em] font-bold text-slate-500">{suffix}</span>}
      </span>

      {showBadge && (
        <button
          type="button"
          onClick={handleToggle}
          title={isRevealed ? "إخفاء" : "إظهار"}
          className={`p-1 rounded-full text-xs transition-colors ${
            isRevealed
              ? 'text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200'
              : 'text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}
    </span>
  );
}

interface PrivacyCardProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  initialRevealed?: boolean;
  blurLevel?: 'sm' | 'md' | 'lg';
  id?: string;
  onClick?: (e: React.MouseEvent) => void;
  showPrivacyHint?: boolean;
  privacyHintText?: string;
}

/**
 * Wrapper for entire financial metric cards.
 * Double clicking anywhere on the card toggles the blur for financial figures inside.
 */
export function PrivacyCard({
  children,
  className = '',
  initialRevealed = false,
  blurLevel = 'md',
  id,
  onClick,
  showPrivacyHint = true,
  privacyHintText = "انقر مرتين للإظهار/الإخفاء"
}: PrivacyCardProps) {
  const [isRevealed, setIsRevealed] = useState(initialRevealed);

  const blurClass = {
    sm: 'blur-xs',
    md: 'blur-[6px]',
    lg: 'blur-md'
  }[blurLevel];

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRevealed(prev => !prev);
  };

  return (
    <div
      id={id}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      title={isRevealed ? "انقر مرتين بالماوس لإعادة التمويه والحفاظ على الخصوصية 🔒" : "انقر مرتين بالماوس لإزالة التمويه وإظهار المبالغ 👁️"}
      className={`relative group cursor-pointer transition-all duration-300 select-none ${className}`}
    >
      <div
        className={`transition-all duration-300 ${
          isRevealed ? 'filter-none' : `${blurClass} select-none`
        }`}
      >
        {children}
      </div>

      {/* Floating Privacy Status Indicator / Hint on hover or when blurred */}
      {showPrivacyHint && (
        <div
          onClick={handleDoubleClick}
          className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all duration-200 cursor-pointer shadow-xs border ${
            isRevealed
              ? 'bg-slate-900/80 text-white border-slate-700 opacity-0 group-hover:opacity-90'
              : 'bg-amber-50/95 text-amber-900 border-amber-300 opacity-80 group-hover:opacity-100 backdrop-blur-xs'
          }`}
          title={isRevealed ? "تم إظهار المبالغ (انقر مرتين لإخفائها)" : "المبالغ مموهة للخصوصية (انقر مرتين لإظهارها)"}
        >
          {isRevealed ? (
            <>
              <Unlock className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-[9px]">معروض 👁️</span>
            </>
          ) : (
            <>
              <Lock className="w-2.5 h-2.5 text-amber-600" />
              <span className="text-[9px]">مموه للخصوصية 🔒</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PrivacyAmount;
