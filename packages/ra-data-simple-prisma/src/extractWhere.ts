import setObjectProp from "set-value";
import { GetListRequest, GetManyReferenceRequest } from "./Http";
import { isNotField } from "./lib/isNotField";
import { isObject } from "./lib/isObject";

const logicalOperators = ["gte", "lte", "lt", "gt", "enum"];

export type FilterMode = "insensitive" | "default" | undefined;

type ExtractWhereOptions = {
  filterMode?: FilterMode;
};

export const extractWhere = (
  req: GetListRequest | GetManyReferenceRequest,
  options?: ExtractWhereOptions
) => {
  const { filter } = req.body.params;

  const where = {};

  if (filter) {
    Object.entries(filter).forEach(([colName, value]) => {
      if (isNotField(colName)) return;

      //TODO: *consider* to move into `isNotField` (but maybe to reset dates is the only way to do it)
      if (value === "")
        //react-admin does send empty strings in empty filters :(
        return;

      const hasOperator = logicalOperators.some((operator) => {
        if (colName.endsWith(`_${operator}`)) {
          [colName] = colName.split(`_${operator}`);
          operator === "enum"
            ? setObjectProp(where, colName, value)
            : setObjectProp(
                where,
                colName,
                { [operator]: value },
                { merge: true }
              );
          return true;
        }
      });
      if (hasOperator) return;

      if (colName === "q") {
        //WHAT THE HECK IS q?
      } else if (
        colName === "id" ||
        colName === "uuid" ||
        colName === "cuid" ||
        colName.endsWith("_id") ||
        colName.endsWith("Id") ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        setObjectProp(where, colName, value);
      } else if (Array.isArray(value)) {
        setObjectProp(where, colName, { in: value });
      } else if (typeof value === "string") {
        setObjectProp(where, colName, {
          contains: value,
          mode: options?.filterMode,
        });
      } else if (isObject(value)) {
        // Experimental: directly use filter object from client
        setObjectProp(where, colName, value);
      } else {
        console.info("Filter not handled:", colName, value);
      }
    });
  }

  return where;
};

const getPostgresJsonFilter = (obj: any) => {
  const path = Object.keys(obj);
  const val = obj[path[0]];
  let equals;
  if (isObject(val)) {
    const { path: returnedPath, equals: returnedEquals } =
      getPostgresJsonFilter(val);
    equals = returnedEquals;
    path.push(...returnedPath);
  } else {
    equals = val;
  }

  return { path, equals };
};
