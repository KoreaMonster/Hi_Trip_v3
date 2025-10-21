import { Compass } from "lucide-react";

export default function NavLogo() {
  return (
    <div className="flex items-center gap-2 text-primary">
      <Compass className="w-5 h-5" />
      <span className="font-semibold">Hi Trip</span>
    </div>
  );
}
