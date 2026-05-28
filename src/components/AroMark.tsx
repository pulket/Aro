import logoUrl from "../assets/aro-logo.png";

interface Props {
  className?: string;
  size?: number;
}

export default function AroMark({ className = "", size = 20 }: Props) {
  return (
    <img
      alt=""
      className={className}
      height={size}
      src={logoUrl}
      style={{ height: size, width: size }}
      width={size}
    />
  );
}
