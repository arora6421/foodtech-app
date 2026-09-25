// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ResolvedImage } from '../../services/imageResolver'
import { DishImage, MenuMark } from './DishImage'

afterEach(cleanup)

const image: ResolvedImage = {
  src: '/a.avif',
  alt: 'Chicken karaage with chicken thigh. Illustrative image, not from Kōen.',
  level: 'archetype',
  illustrative: true,
  cutout: false,
}
const frame = () => document.querySelector<HTMLElement>('.dish-media')!

describe('DishImage', () => {
  it('with no image, shows the designed no-photo art and hides the frame from screen readers', () => {
    render(<DishImage variant="hero" image={null} tint="#c8894a" art={<MenuMark text="C" />} />)
    expect(frame().dataset.state).toBe('none')
    expect(frame().querySelector('img')).toBeNull()
    expect(screen.getByText('C')).toBeTruthy()
    expect(frame().getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the art showing while the photo loads, then reveals the photo once it has loaded', () => {
    render(<DishImage variant="hero" image={image} tint="#c8894a" art={<MenuMark text="C" />} />)
    expect(frame().dataset.state).toBe('pending')
    expect(screen.getByText('C')).toBeTruthy()
    expect(screen.queryByText('Illustrative image')).toBeNull()
    fireEvent.load(frame().querySelector('img')!)
    expect(frame().dataset.state).toBe('loaded')
    expect(screen.getByText('Illustrative image')).toBeTruthy()
  })

  it('drops a failed photo and keeps the art, in the same frame', () => {
    render(<DishImage variant="card" image={image} tint="#c8894a" art={<MenuMark text="4" />} decorative />)
    const before = frame()
    fireEvent.error(before.querySelector('img')!)
    expect(frame()).toBe(before)
    expect(frame().dataset.state).toBe('failed')
    expect(frame().querySelector('img')).toBeNull()
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('gives a meaningful alt by default and an empty alt when decorative', () => {
    const { rerender } = render(<DishImage variant="hero" image={image} tint="#c8894a" art={null} />)
    expect(frame().querySelector('img')!.getAttribute('alt')).toBe(image.alt)
    expect(frame().getAttribute('aria-hidden')).toBeNull()
    rerender(<DishImage variant="thumb" image={image} tint="#c8894a" art={null} decorative />)
    expect(frame().querySelector('img')!.getAttribute('alt')).toBe('')
    expect(frame().getAttribute('aria-hidden')).toBe('true')
  })

  it('starts over when the dish changes, and never offers the photo for native drag', () => {
    const { rerender } = render(<DishImage variant="card" image={image} tint="#c8894a" art={null} decorative />)
    fireEvent.load(frame().querySelector('img')!)
    rerender(<DishImage variant="card" image={{ ...image, src: '/b.avif' }} tint="#c8894a" art={null} decorative />)
    expect(frame().dataset.state).toBe('pending')
    expect(frame().querySelector('img')!.getAttribute('draggable')).toBe('false')
  })

  it('marks a cutout so it is fitted whole on the tint, and fades the no-photo art once it has loaded', () => {
    const { rerender } = render(
      <DishImage
        variant="card"
        image={{ ...image, cutout: true }}
        tint="#c8894a"
        art={<MenuMark text="2" />}
        decorative
      />,
    )
    expect(frame().dataset.kind).toBe('cutout')
    fireEvent.load(frame().querySelector('img')!)
    expect(frame().dataset.state).toBe('loaded') // CSS hides .dish-media-art in this state
    rerender(<DishImage variant="card" image={{ ...image, src: '/p.jpg' }} tint="#c8894a" art={null} decorative />)
    expect(frame().dataset.kind).toBe('photo')
    rerender(<DishImage variant="card" image={null} tint="#c8894a" art={null} decorative />)
    expect(frame().dataset.kind).toBeUndefined()
  })

  it('a failed cutout falls back to the no-photo art like any image', () => {
    render(<DishImage variant="hero" image={{ ...image, cutout: true }} tint="#c8894a" art={<MenuMark text="C" />} />)
    fireEvent.error(frame().querySelector('img')!)
    expect(frame().dataset.state).toBe('failed')
    expect(screen.getByText('C')).toBeTruthy()
  })

  it('shows the illustrative note on large frames only', () => {
    render(<DishImage variant="thumb" image={image} tint="#c8894a" art={null} decorative />)
    fireEvent.load(frame().querySelector('img')!)
    expect(screen.queryByText('Illustrative image')).toBeNull()
  })
})
