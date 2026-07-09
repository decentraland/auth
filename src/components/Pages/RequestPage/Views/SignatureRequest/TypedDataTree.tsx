import { Fragment } from 'react'
import { Section, TreeKey, TreeNode, TreeValue } from './SignatureRequest.styled'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const renderScalar = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

const TreeEntries = ({ data, depth }: { data: Record<string, unknown>; depth: number }) => (
  <>
    {Object.entries(data).map(([key, value]) => {
      if (isPlainObject(value)) {
        return (
          <Fragment key={key}>
            <TreeNode depth={depth}>
              <TreeKey>{key}:</TreeKey>
            </TreeNode>
            <TreeEntries data={value} depth={depth + 1} />
          </Fragment>
        )
      }
      if (Array.isArray(value)) {
        return (
          <Fragment key={key}>
            <TreeNode depth={depth}>
              <TreeKey>{key}:</TreeKey>
            </TreeNode>
            {value.map((item, index) =>
              isPlainObject(item) ? (
                <TreeEntries key={index} data={item} depth={depth + 1} />
              ) : (
                <TreeNode key={index} depth={depth + 1}>
                  <TreeValue>{renderScalar(item)}</TreeValue>
                </TreeNode>
              )
            )}
          </Fragment>
        )
      }
      return (
        <TreeNode depth={depth} key={key}>
          <TreeKey>{key}:</TreeKey>
          <TreeValue>{renderScalar(value)}</TreeValue>
        </TreeNode>
      )
    })}
  </>
)

export const TypedDataTree = ({ data }: { data: Record<string, unknown> }) => (
  <Section>
    <TreeEntries data={data} depth={0} />
  </Section>
)
