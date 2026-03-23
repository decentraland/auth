import './polyfills'

describe('polyfills', () => {
  describe('translation extension DOM patches', () => {
    let parent: HTMLDivElement
    let child: HTMLSpanElement

    beforeEach(() => {
      parent = document.createElement('div')
      child = document.createElement('span')
      parent.appendChild(child)
      document.body.appendChild(parent)
    })

    afterEach(() => {
      document.body.removeChild(parent)
    })

    describe('when removeChild is called and the child belongs to the parent', () => {
      it('should remove the child normally', () => {
        parent.removeChild(child)
        expect(parent.contains(child)).toBe(false)
      })
    })

    describe('when removeChild is called and the child does not belong to the parent', () => {
      it('should return the child without throwing', () => {
        const otherParent = document.createElement('div')
        otherParent.appendChild(child)

        const result = parent.removeChild(child)

        expect(result).toBe(child)
        expect(otherParent.contains(child)).toBe(true)
      })
    })

    describe('when insertBefore is called and the reference node belongs to the parent', () => {
      it('should insert the new node normally', () => {
        const newNode = document.createElement('em')
        parent.insertBefore(newNode, child)

        expect(parent.firstChild).toBe(newNode)
        expect(parent.contains(newNode)).toBe(true)
      })
    })

    describe('when insertBefore is called and the reference node does not belong to the parent', () => {
      it('should return the new node without throwing', () => {
        const otherParent = document.createElement('div')
        otherParent.appendChild(child)

        const newNode = document.createElement('em')
        const result = parent.insertBefore(newNode, child)

        expect(result).toBe(newNode)
        expect(parent.contains(newNode)).toBe(false)
      })
    })

    describe('when insertBefore is called with a null reference node', () => {
      it('should append the new node normally', () => {
        const newNode = document.createElement('em')
        parent.insertBefore(newNode, null)

        expect(parent.lastChild).toBe(newNode)
      })
    })
  })
})
