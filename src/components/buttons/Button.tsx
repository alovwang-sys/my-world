import clsx from 'clsx';
import { MouseEventHandler, ReactNode } from 'react';

export default function Button(props: {
  className?: string;
  href?: string;
  imgUrl?: string;
  onClick?: MouseEventHandler;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const content = (
    <>
      {props.imgUrl && <img src={props.imgUrl} alt="" />}
      {props.children}
    </>
  );
  const className = clsx('town-button', props.className);
  return props.href ? (
    <a className={className} href={props.href} title={props.title}>
      {content}
    </a>
  ) : (
    <button
      type="button"
      className={className}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {content}
    </button>
  );
}
