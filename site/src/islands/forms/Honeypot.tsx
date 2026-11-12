/** Hidden from people and assistive technology; bots that fill every field reveal themselves. */
export function Honeypot({ value, onInput }: { value: string; onInput: (v: string) => void }) {
  return (
    <div class="absolute left-[-9999px]" aria-hidden="true">
      <label>
        Website
        <input
          type="text"
          tabIndex={-1}
          autocomplete="off"
          name="website"
          value={value}
          onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </div>
  );
}
