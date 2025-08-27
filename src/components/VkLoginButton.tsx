type Props = { onLogin: () => void };

export default function VkLoginButton({ onLogin }: Props) {
  return (
    <button
      onClick={onLogin}
      className="w-full inline-flex items-center justify-center rounded-md bg-[#2787F5] px-4 py-3 text-white font-medium hover:opacity-90 transition"
    >
      Войти через VK ID
    </button>
  );
}