import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼의 크기 설정. 기본값은 'md' 입니다. */
  size?: 'xl' | 'lg' | 'md';
  /** 버튼의 시각적 상태 변형. 가이드 데모용으로 사용됩니다. */
  variant?: 'default' | 'hover' | 'focused-dark' | 'focused-light' | 'disabled';
  /** 아이콘의 위치 설정 */
  iconPosition?: 'left' | 'right' | 'only';
  /** 아이콘 클래스 명 (icons.css 에 정의된 클래스 사용) */
  icon?: string;
  children?: React.ReactNode;
}

/**
 * Tixup 디자인 시스템의 공용 Button 컴포넌트입니다.
 * components.css 의 .btn 스타일을 기반으로 동작합니다.
 */
export const Button: React.FC<ButtonProps> = ({
  size = 'md',
  variant = 'default',
  iconPosition,
  icon = 'icon-work',
  children,
  className = '',
  ...props
}) => {
  const sizeClass = size === 'md' ? '' : `btn-${size}`;
  const variantClass = variant !== 'default' ? `btn-${variant}` : '';
  const iconOnlyClass = iconPosition === 'only' ? 'btn-icon-only' : '';
  
  const combinedClassName = `btn ${sizeClass} ${variantClass} ${iconOnlyClass} ${className}`.trim().replace(/\s+/g, ' ');

  return (
    <button 
      className={combinedClassName} 
      disabled={variant === 'disabled' || props.disabled}
      {...props}
    >
      {iconPosition === 'left' && <i className={`icon ${icon}`} />}
      {iconPosition === 'only' ? (
        <i className={`icon ${icon}`} />
      ) : (
        <>
          {children}
          {iconPosition === 'right' && <i className={`icon ${icon}`} />}
        </>
      )}
    </button>
  );
};
