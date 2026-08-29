/**
 * Compatibility polyfills for Node.js < 22 runtime environments.
 * Specifically adds ECMAScript 2024 Set methods used by PostCSS / cssnano dependencies.
 */

if (typeof Set !== 'undefined') {
  if (!Set.prototype.difference) {
    Set.prototype.difference = function difference(other) {
      const result = new Set(this);
      if (other && typeof other[Symbol.iterator] === 'function') {
        for (const item of other) {
          result.delete(item);
        }
      }
      return result;
    };
  }

  if (!Set.prototype.intersection) {
    Set.prototype.intersection = function intersection(other) {
      const result = new Set();
      const otherSet = other instanceof Set ? other : new Set(other);
      for (const item of this) {
        if (otherSet.has(item)) {
          result.add(item);
        }
      }
      return result;
    };
  }

  if (!Set.prototype.union) {
    Set.prototype.union = function union(other) {
      const result = new Set(this);
      if (other && typeof other[Symbol.iterator] === 'function') {
        for (const item of other) {
          result.add(item);
        }
      }
      return result;
    };
  }

  if (!Set.prototype.symmetricDifference) {
    Set.prototype.symmetricDifference = function symmetricDifference(other) {
      const result = new Set(this);
      const otherSet = other instanceof Set ? other : new Set(other);
      for (const item of otherSet) {
        if (this.has(item)) {
          result.delete(item);
        } else {
          result.add(item);
        }
      }
      return result;
    };
  }

  if (!Set.prototype.isSubsetOf) {
    Set.prototype.isSubsetOf = function isSubsetOf(other) {
      const otherSet = other instanceof Set ? other : new Set(other);
      for (const item of this) {
        if (!otherSet.has(item)) return false;
      }
      return true;
    };
  }

  if (!Set.prototype.isSupersetOf) {
    Set.prototype.isSupersetOf = function isSupersetOf(other) {
      if (other && typeof other[Symbol.iterator] === 'function') {
        for (const item of other) {
          if (!this.has(item)) return false;
        }
      }
      return true;
    };
  }

  if (!Set.prototype.isDisjointFrom) {
    Set.prototype.isDisjointFrom = function isDisjointFrom(other) {
      const otherSet = other instanceof Set ? other : new Set(other);
      for (const item of this) {
        if (otherSet.has(item)) return false;
      }
      return true;
    };
  }
}
