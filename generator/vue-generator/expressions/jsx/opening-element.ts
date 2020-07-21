import { JsxOpeningElement as BaseJsxOpeningElement } from "../../../angular-generator/expressions/jsx/jsx-opening-element";
import { JsxAttribute } from "./attribute";
import { JsxSpreadAttribute } from "./spread-attribute";
import {
  Expression,
  SimpleExpression,
} from "../../../base-generator/expressions/base";
import { GeneratorContext } from "../../../base-generator/types";
import { toStringOptions } from "../../types";
import { Identifier } from "../../../base-generator/expressions/common";
import { Property } from "../../../base-generator/expressions/class-members";
import {
  PropertyAssignment,
  SpreadAssignment,
} from "../../../base-generator/expressions/property-assignment";
import { ObjectLiteral } from "../../../base-generator/expressions/literal";
import { BaseFunction } from "../../../base-generator/expressions/functions";
import {
  Component,
  getProps,
} from "../../../base-generator/expressions/component";
import { PropertyAccess } from "../property-access";
import { JsxExpression, JsxChildExpression } from "./jsx-expression";
import SyntaxKind from "../../../base-generator/syntaxKind";
import { JsxElement } from "./element";
import { getMember } from "../../../angular-generator/utils";

export class JsxOpeningElement extends BaseJsxOpeningElement {
  attributes: Array<JsxAttribute | JsxSpreadAttribute>;
  constructor(
    tagName: Expression,
    typeArguments: any,
    attributes: Array<JsxAttribute | JsxSpreadAttribute> = [],
    context: GeneratorContext
  ) {
    super(tagName, typeArguments, attributes, context);
    this.attributes = attributes;
    if (this.component) {
      const components = this.context.components!;
      const name = Object.keys(components).find(
        (k) => components[k] === this.component
      )!;

      this.tagName = new SimpleExpression(name);
    }
  }

  createJsxExpression(statement: Expression) {
    return new JsxExpression(undefined, statement);
  }

  createJsxChildExpression(statement: JsxExpression) {
    return new JsxChildExpression(statement);
  }

  processTagName(tagName: Expression) {
    if (tagName.toString() === "Fragment") {
      return new SimpleExpression('div style="display: contents"');
    }

    return tagName;
  }

  compileTemplate(templateProperty: Property, options?: toStringOptions) {
    const attributes = this.attributes.map((a) => a.getTemplateProp(options));
    return `<slot name="${templateProperty.name}" ${attributes.join(
      " "
    )}></slot>`;
  }

  createJsxAttribute(name: Identifier, value: Expression) {
    return new JsxAttribute(name, value);
  }

  getPropertyFromSpread(property: Property) {
    return property.isEvent || property.isSlot;
  }

  updateSpreadAttribute(
    spreadAttribute: JsxSpreadAttribute,
    attributes: JsxAttribute[]
  ) {
    if (attributes.length) {
      const propertyAssignments = attributes.map((p) => {
        return new PropertyAssignment(
          p.name,
          new SimpleExpression(SyntaxKind.UndefinedKeyword)
        );
      });

      return new JsxSpreadAttribute(
        undefined,
        new ObjectLiteral(
          [
            new SpreadAssignment(spreadAttribute.expression),
            new SpreadAssignment(new ObjectLiteral(propertyAssignments, false)),
          ],
          false
        )
      );
    }

    return spreadAttribute;
  }

  processSpreadAttributesOnNativeElement() {}

  getTemplateName(attribute: JsxAttribute) {
    return attribute.name.toString();
  }

  functionToJsxElement(
    name: string,
    func: BaseFunction,
    options?: toStringOptions
  ): JsxElement {
    const element = func.getTemplate(options, true);
    const paramName = func.parameters[0].name.toString(options);

    return new JsxElement(
      new JsxOpeningElement(
        new Identifier(`template v-slot:${name}="${paramName}"`),
        undefined,
        [],
        this.context
      ),
      [element],
      new JsxClosingElement(new Identifier("template"), this.context)
    );
  }

  componentToJsxElement(name: string, component: Component): JsxElement {
    const paramName = "slotProps";
    const attributes = getProps(component.members).map(
      (prop) =>
        new JsxAttribute(
          prop._name,
          new PropertyAccess(new Identifier(paramName), prop._name)
        )
    );

    const componentName = Object.keys(this.context.components!).find(
      (k) => this.context.components![k] === component
    )!;
    const element = new JsxSelfClosingElement(
      new Identifier(componentName),
      undefined,
      attributes,
      component.context
    );

    return new JsxElement(
      new JsxOpeningElement(
        new Identifier(`template v-slot:${name}="${paramName}"`),
        undefined,
        [],
        this.context
      ),
      [element],
      new JsxClosingElement(new Identifier("template"), this.context)
    );
  }

  templatePropToJsxElement(
    template: JsxAttribute,
    options?: toStringOptions
  ): JsxElement {
    const destSlotName = this.getTemplateName(template);
    const slotName = getMember(template.initializer, options)!.name;

    return new JsxElement(
      new JsxOpeningElement(
        new Identifier(`template v-slot:${destSlotName}="slotProps"`),
        undefined,
        [],
        this.context
      ),
      [`<slot name=${slotName} v-bind="slotProps"></slot>`],
      new JsxClosingElement(new Identifier("template"), this.context)
    );
  }

  clone() {
    return new JsxOpeningElement(
      this.tagName,
      this.typeArguments,
      this.attributes.slice(),
      this.context
    );
  }
}

export class JsxSelfClosingElement extends JsxOpeningElement {
  toString(options?: toStringOptions) {
    if (this.getTemplateProperty(options)) {
      return super.toString(options);
    }

    const baseValue = super.toString(options);

    const children = [
      ...this.getSlotsFromAttributes(options),
      ...this.getTemplatesFromAttributes(options),
    ];

    if (children.length) {
      return `${baseValue}${children
        .map((c) => c.toString(options))
        .join("")}</${this.processTagName(this.tagName)}>`;
    }

    return baseValue.replace(/>$/, "/>");
  }

  clone() {
    return new JsxSelfClosingElement(
      this.tagName,
      this.typeArguments,
      this.attributes.slice(),
      this.context
    );
  }
}

export class JsxClosingElement extends JsxOpeningElement {
  constructor(tagName: Expression, context: GeneratorContext) {
    super(tagName, [], [], context);
  }

  processTagName(tagName: Expression) {
    if (tagName.toString() === "Fragment") {
      return new SimpleExpression("div");
    }

    return tagName;
  }

  toString(options: toStringOptions) {
    return `</${this.processTagName(this.tagName).toString(options)}>`;
  }
}