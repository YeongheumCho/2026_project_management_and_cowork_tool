type Props = {
  children: React.ReactNode;
  tone?: 'default' | 'error';
};

export default function HelperText({ children, tone = 'default' }: Props) {
  return (
    <span className={`field-helper ${tone === 'error' ? 'text-red-600' : ''}`}>
      {children}
    </span>
  );
}
