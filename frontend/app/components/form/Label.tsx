import { LabelHTMLAttributes } from 'react';

type Props = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

/** 단독 라벨 — Field 컴포넌트 안 쓰고 라벨만 필요할 때 */
export default function Label({ required, className = '', children, ...rest }: Props) {
  return (
    <label className={`field-label ${className}`} {...rest}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}
