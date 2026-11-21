type UsernameInputProps = {
  id: string;
  value: string;
  onChange: (username: string) => void;
  hintId?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: 'username' | 'off';
};

export function UsernameInput({ id, value, onChange, hintId, required, disabled, autoComplete = 'username' }: UsernameInputProps) {
  return <div className="username-input">
    <span aria-hidden="true">@</span>
    <input id={id} value={value} required={required} disabled={disabled}
      autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false}
      aria-describedby={hintId} placeholder="alex_01" pattern="[A-Za-z0-9_]{3,30}"
      title="От 3 до 30 латинских букв, цифр или подчёркиваний"
      onChange={event => onChange(event.target.value.replace(/^@+/, ''))} />
  </div>;
}
