import { LoginForm } from "../forms";

export default function AdminLogin() {
  return (
    <div className="sticker pop-in mx-auto mt-10 max-w-sm rounded-[2rem] bg-lilac-soft p-8 hover:!transform-none">
      <div className="float mb-3 text-center text-6xl">🔐</div>
      <h1 className="mb-6 text-center font-display text-3xl font-bold">admin corner</h1>
      <LoginForm />
    </div>
  );
}
