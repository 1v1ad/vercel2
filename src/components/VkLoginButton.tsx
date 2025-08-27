import React from 'react';

type Props = { onLogin: () => void };

export default function VkLoginButton({ onLogin }: Props) {
  return (
    <button
      onClick={onLogin}
      className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none"
    >
      Войти через VK ID
    </button>
  );
}
