'use client';

import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = 'a, button, [data-magnetic], .node, .step, .role, .pillar, .mock-row';
const PARALLAX_FACTORS = [0.08, 0.12, -0.06, 0.1];

export default function LandingEffects() {
  useEffect(() => {
    const cleanupFns: Array<() => void> = [];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const rail = document.getElementById('rail');
    const nav = document.getElementById('nav');
    const root = document.documentElement;
    const blobEls = Array.from(document.querySelectorAll<HTMLElement>('.blobs i'));

    let scrollRaf = 0;
    const applyScrollEffects = () => {
      const scrollTop = root.scrollTop;
      const maxScroll = root.scrollHeight - root.clientHeight;
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

      if (rail) {
        rail.style.setProperty('--p', `${progress.toFixed(2)}%`);
      }
      nav?.classList.toggle('scrolled', scrollTop > 40);

      if (!prefersReducedMotion) {
        blobEls.forEach((el, index) => {
          const factor = PARALLAX_FACTORS[index] ?? 0.1;
          el.style.transform = `translate3d(0, ${scrollTop * factor}px, 0)`;
        });
      }

      scrollRaf = 0;
    };

    const onScroll = () => {
      if (scrollRaf) {
        return;
      }
      scrollRaf = window.requestAnimationFrame(applyScrollEffects);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    applyScrollEffects();

    cleanupFns.push(() => {
      window.removeEventListener('scroll', onScroll);
      if (scrollRaf) {
        window.cancelAnimationFrame(scrollRaf);
      }
    });

    const cursor = document.getElementById('cursor');
    if (cursor && hasFinePointer && !prefersReducedMotion) {
      let cx = 0;
      let cy = 0;
      let tx = 0;
      let ty = 0;
      let cursorRaf = 0;

      const animateCursor = () => {
        const dx = tx - cx;
        const dy = ty - cy;
        cx += dx * 0.18;
        cy += dy * 0.18;
        cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
          cursorRaf = window.requestAnimationFrame(animateCursor);
        } else {
          cursorRaf = 0;
        }
      };

      const onPointerMoveWithRaf = (event: PointerEvent) => {
        tx = event.clientX;
        ty = event.clientY;
        if (!cursorRaf) {
          cursorRaf = window.requestAnimationFrame(animateCursor);
        }
      };

      window.addEventListener('pointermove', onPointerMoveWithRaf, { passive: true });
      cursorRaf = window.requestAnimationFrame(animateCursor);

      const interactiveEls = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));
      interactiveEls.forEach((el) => {
        const onEnter = () => cursor.classList.add('hover');
        const onLeave = () => cursor.classList.remove('hover');
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
        cleanupFns.push(() => {
          el.removeEventListener('mouseenter', onEnter);
          el.removeEventListener('mouseleave', onLeave);
        });
      });

      const magneticButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-magnetic]'));
      magneticButtons.forEach((button) => {
        const onMagneticMove = (event: PointerEvent) => {
          const rect = button.getBoundingClientRect();
          const mx = event.clientX - rect.left - rect.width / 2;
          const my = event.clientY - rect.top - rect.height / 2;
          button.style.transform = `translate(${mx * 0.18}px, ${my * 0.28}px)`;
        };
        const onMagneticLeave = () => {
          button.style.transform = '';
        };

        button.addEventListener('pointermove', onMagneticMove);
        button.addEventListener('pointerleave', onMagneticLeave);
        cleanupFns.push(() => {
          button.removeEventListener('pointermove', onMagneticMove);
          button.removeEventListener('pointerleave', onMagneticLeave);
          button.style.transform = '';
        });
      });

      cleanupFns.push(() => {
        window.removeEventListener('pointermove', onPointerMoveWithRaf);
        if (cursorRaf) window.cancelAnimationFrame(cursorRaf);
      });
    } else if (cursor) {
      cursor.style.display = 'none';
    }

    const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal, .words'));
    if (prefersReducedMotion) {
      revealEls.forEach((el) => el.classList.add('in'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
      );

      revealEls.forEach((el) => observer.observe(el));
      cleanupFns.push(() => observer.disconnect());
    }

    const marqueeTrack = document.getElementById('mtrack');
    if (marqueeTrack && marqueeTrack.childElementCount === 0) {
      const parts = ['Consent is a right', '/', 'Access is earned', '/', 'Audit is forever', '/', 'Keys to the cared-for', '/'];
      const line = parts
        .map((word) => (word === '/' ? '<span class="sep">·</span>' : `<span>${word.replace(/\b(\w+)$/, '<em>$1</em>')}</span>`))
        .join('');
      marqueeTrack.innerHTML = line + line;
    }

    if (!prefersReducedMotion) {
      const svg = document.getElementById('links') as SVGSVGElement | null;
      const container = document.getElementById('constellation');
      const nodes = Array.from(container?.querySelectorAll<HTMLElement>('.node') ?? []);

      if (svg && container && nodes.length > 0) {
        const draw = () => {
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (!width || !height) {
            return;
          }

          const containerRect = container.getBoundingClientRect();
          Array.from(svg.querySelectorAll('.link, .pkt, .cap')).forEach((node) => node.remove());

          nodes.forEach((node) => {
            const rect = node.getBoundingClientRect();
            const x = ((rect.left - containerRect.left + rect.width / 2) / width) * 1000;
            const y = ((rect.top - containerRect.top + rect.height / 2) / height) * 600;

            const link = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            link.setAttribute('class', 'link');
            link.setAttribute('x1', x.toString());
            link.setAttribute('y1', y.toString());
            link.setAttribute('x2', '500');
            link.setAttribute('y2', '300');
            link.setAttribute('stroke', 'url(#lg)');
            link.setAttribute('stroke-width', '1.2');
            link.setAttribute('stroke-dasharray', '2 5');
            svg.appendChild(link);

            const packet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            packet.setAttribute('class', 'pkt');
            packet.setAttribute('r', '3');

            const animateX = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animateX.setAttribute('attributeName', 'cx');
            animateX.setAttribute('values', `${x};500;${x}`);
            animateX.setAttribute('dur', `${6 + Math.random() * 4}s`);
            animateX.setAttribute('repeatCount', 'indefinite');

            const animateY = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animateY.setAttribute('attributeName', 'cy');
            animateY.setAttribute('values', `${y};300;${y}`);
            animateY.setAttribute('dur', animateX.getAttribute('dur') ?? '8s');
            animateY.setAttribute('repeatCount', 'indefinite');

            packet.appendChild(animateX);
            packet.appendChild(animateY);
            svg.appendChild(packet);
          });
        };

        let drawRaf = 0;
        const scheduleDraw = () => {
          if (drawRaf) {
            return;
          }
          drawRaf = window.requestAnimationFrame(() => {
            drawRaf = 0;
            draw();
          });
        };

        const observer = new ResizeObserver(scheduleDraw);
        observer.observe(container);
        const initialDrawTimeout = window.setTimeout(scheduleDraw, 120);

        cleanupFns.push(() => {
          observer.disconnect();
          window.clearTimeout(initialDrawTimeout);
          if (drawRaf) {
            window.cancelAnimationFrame(drawRaf);
          }
        });
      }
    }

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
