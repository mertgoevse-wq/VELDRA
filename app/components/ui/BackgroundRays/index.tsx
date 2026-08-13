import styles from './styles.module.scss';

interface BackgroundRaysProps {
  /**
   * `position: fixed` (the default) is correct for a standalone full-page background (e.g.
   * routes/git.tsx). Inside a modal on a transformed ancestor (Framer Motion's animated dialog
   * surface), `fixed` establishes its containing block against that transformed ancestor instead
   * of the true viewport -- combined with this component's `mix-blend-mode` rays, that produced a
   * real bleed-through of whatever sits behind the modal (the app's own header) into the dialog.
   * `contained` renders it `position: absolute` instead, clipped by the modal's own
   * `overflow-hidden` surface, with identical visual coverage inside the dialog and no way to
   * interact with anything outside it.
   */
  variant?: 'fixed' | 'contained';
}

const BackgroundRays = ({ variant = 'fixed' }: BackgroundRaysProps) => {
  return (
    <div className={`${styles.rayContainer} ${variant === 'contained' ? styles.rayContainerContained : ''}`}>
      <div className={`${styles.lightRay} ${styles.ray1}`}></div>
      <div className={`${styles.lightRay} ${styles.ray2}`}></div>
      <div className={`${styles.lightRay} ${styles.ray3}`}></div>
      <div className={`${styles.lightRay} ${styles.ray4}`}></div>
      <div className={`${styles.lightRay} ${styles.ray5}`}></div>
      <div className={`${styles.lightRay} ${styles.ray6}`}></div>
      <div className={`${styles.lightRay} ${styles.ray7}`}></div>
      <div className={`${styles.lightRay} ${styles.ray8}`}></div>
    </div>
  );
};

export default BackgroundRays;
