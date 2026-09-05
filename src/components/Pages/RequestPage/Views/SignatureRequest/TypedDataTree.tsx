import { Fragment } from 'react'
import { TypedDataReviewNode } from '../../../../../shared/auth/typedDataReview'
import { Section, TreeKey, TreeNode, TreeValue } from './SignatureRequest.styled'

// Only render nodes resolved from the signed schema. Preserve array indices and types so nested
// structures cannot flatten into misleading, apparently unrelated fields.
const TreeEntries = ({ fields, depth }: { fields: TypedDataReviewNode[]; depth: number }) => (
  <>
    {fields.map(field => (
      <Fragment key={field.name}>
        <TreeNode depth={depth}>
          <TreeKey>
            {field.name} ({field.type}):
          </TreeKey>
          {field.children ? (
            field.children.length === 0 ? (
              <TreeValue>{field.type.endsWith(']') ? '[]' : '{}'}</TreeValue>
            ) : null
          ) : (
            <TreeValue>{field.value}</TreeValue>
          )}
        </TreeNode>
        {field.children ? <TreeEntries fields={field.children} depth={depth + 1} /> : null}
      </Fragment>
    ))}
  </>
)

export const TypedDataTree = ({ fields }: { fields: TypedDataReviewNode[] }) => (
  <Section>
    <TreeEntries fields={fields} depth={0} />
  </Section>
)
