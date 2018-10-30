import { Scope, SourceFile, PropertyDeclarationStructure, ParameterDeclaration, DecoratorStructure, JSDocStructure, ClassDeclaration } from 'ts-simple-ast';
import { Field, SObjectDescribe, ChildRelationship, Rest, RestObject, SalesforceFieldType, SFieldProperties, sField } from 'ts-force';
import { Spinner } from 'cli-spinner';
import { SObjectConfig, FieldMapping } from './sObjectConfig';
import { cleanAPIName } from './util';

const superClass = 'RestObject';

interface SalesforceDecoratorProps {
    apiName: string;
    createable: boolean;
    updateable: boolean;
    required: boolean;
    externalId: boolean;
    childRelationship: boolean;
    reference: any;
    salesforceLabel: string;
    salesforceType: SalesforceFieldType;
}

export class SObjectGenerator {

    public sObjectConfigs: SObjectConfig[];
    public classInterfaceMap: Map<string, string>;
    public sourceFile: SourceFile;
    public spinner: any;

    private client;

    /**
    * Generates RestObject Concrete types
    * @param {SourceFile} sourceFile: Location to save the files
    * @param {string[]} sObjectConfigs: Salesforce API Object Names to generate Classes for
    * @memberof SObjectGenerator
    */
    constructor (sourceFile: SourceFile, sObjectConfigs: SObjectConfig[]) {
        this.sObjectConfigs = sObjectConfigs;
        this.classInterfaceMap = new Map<string,string>();
        this.sourceFile = sourceFile;
        this.client = new Rest();
    }

    public async generateFile () {
        this.spinner = new Spinner({
            text: 'warming up...',
            stream: process.stderr,
            onTick: function (msg) {
                this.clearLine(this.stream);
                this.stream.write(msg);
            }
        });
        this.spinner.setSpinnerString(5);
        this.spinner.setSpinnerDelay(20);
        this.spinner.start();

        try {
        // add imports
        this.sourceFile.addImportDeclaration({
            moduleSpecifier: 'ts-force',
            namedImports: [
                { name: 'RestObject' },
                { name: 'SObject' },
                { name: 'sField' },
                { name: 'SalesforceFieldType' },
                { name: 'SFLocation' },
                { name: 'SFieldProperties' }
            ]
        });

        for (let i = 0; i < this.sObjectConfigs.length; i++) {
            let className = this.sanitizeClassName(this.sObjectConfigs[i]);
            let interfaceName = this.generatePropInterfaceName(className);
            this.classInterfaceMap.set(className, interfaceName);
        }

        for (let i = 0; i < this.sObjectConfigs.length; i++) {

            await this.generateSObjectClass(this.sObjectConfigs[i]);

        }
        }catch (e) {
            this.spinner.stop();
            throw e;
        }
        this.spinner.stop();
    }

    // class generation
    public async generateSObjectClass (sobConfig: SObjectConfig): Promise<void> {

        this.spinner.setSpinnerTitle(`Generating: ${sobConfig.apiName}`);
        let sobDescribe: SObjectDescribe;
        try {
            sobDescribe = await this.retrieveDescribe(sobConfig.apiName);
        }catch (e) {
            throw new Error(`Could not retrieve describe metadata for ${sobConfig.apiName}. Check SObject spelling and authorization `);
        }

        let props: PropertyDeclarationStructure[] = [];

        // generate props from fields & children
        props.push(...this.generateChildrenProps(sobConfig, sobDescribe.childRelationships));
        props.push(...this.generateFieldProps(sobConfig, sobDescribe.fields));

        let className = this.sanitizeClassName(sobConfig);

        this.generateInterface(className, props, sobConfig.apiName);

        let classDeclaration = this.generateClass(sobConfig, className, props);

        classDeclaration.addProperty({
            name: 'API_NAME',
            scope: Scope.Public,
            isStatic: true,
            type: `'${sobConfig.apiName}'`,
            initializer: `'${sobConfig.apiName}'`
        });

        classDeclaration.addProperty({
            name: '_TYPE_',
            scope: Scope.Public,
            type: `'${sobConfig.apiName}'`,
            initializer: `'${sobConfig.apiName}'`
        });

        classDeclaration.addProperty({
            name: '_fields',
            scope: Scope.Private,
            isStatic: true,
            type: `{[P in keyof ${this.classInterfaceMap.get(className)}]: SFieldProperties;}`
        });

        classDeclaration.addGetAccessor({
            name: 'FIELDS',
            scope: Scope.Public,
            isStatic: true,
            bodyText: `return this._fields = this._fields ? this._fields : ${className}.getPropertiesMeta<${this.classInterfaceMap.get(className)},${className}>(${className})`
        });

        const qryMethod = classDeclaration.addMethod({
            name: 'retrieve',
            isStatic: true,
            scope: Scope.Public,
            parameters: [
                { name: 'qry', type: 'string' }
            ],
            returnType: `Promise<${className}[]>`,
            isAsync: true,
            bodyText: `return await ${superClass}.query<${className}>(${className}, qry);`
        });

        const fromSfMethod = classDeclaration.addMethod({
            name: 'fromSFObject',
            isStatic: true,
            scope: Scope.Public,
            parameters: [
                { name: 'sob', type: 'SObject' }
            ],
            returnType: `${className}`,
            bodyText: `return new ${className}().mapFromQuery(sob);`
        });

        classDeclaration.forget();

    }

    private generateInterface (className: string, properties: PropertyDeclarationStructure[], apiName: string) {
        let propsInterface = this.sourceFile.addInterface({
            name: this.classInterfaceMap.get(className),
            isExported: true,
            docs: [{description: `Immutable Property Interface for ${className}` }]
        });

        propsInterface.addProperty({
            name: '_TYPE_',
            isReadonly: true,
            hasQuestionToken: true,
            type: `'${apiName}'`
        });

        properties.forEach(prop => {
            // this is quite hackish and should be refactored ASAP
            let isArr = false;
            let pType = prop.type as string;
            if (pType.indexOf('[]') > -1) {
                isArr = true;
                pType = pType.replace('[]','');
            }
            let interfaceType = this.classInterfaceMap.get(pType);
            let ip = propsInterface.addProperty({
                name: prop.name,
                type: interfaceType ? (isArr ? `${interfaceType}[]` : interfaceType) : prop.type,
                isReadonly: true,
                hasQuestionToken: true
            });
        });

        propsInterface.forget();
    }

    private generateClass (sobConfig: SObjectConfig, className: string, props: PropertyDeclarationStructure[]): ClassDeclaration {
        let propInterfaceName = this.classInterfaceMap.get(className);

        let classDeclaration = this.sourceFile.addClass({
            name: className,
            extends: superClass,
            isExported: true,
            properties: props,
            implements: [propInterfaceName],
            docs: [{description: `Generated class for ${sobConfig.apiName}` }]
        });

        const interfaceParamName = 'fields';
        const constr = classDeclaration.addConstructor();
        const param = constr.addParameter({
            name: interfaceParamName,
            type: propInterfaceName,
            hasQuestionToken: true
        });

        const propsInit = props.map(prop => {
            return `this.${prop.name} = void 0;`;
        }).join('\n');

        constr.setBodyText(`super('${sobConfig.apiName}');
        ${propsInit}
        Object.assign(this,${interfaceParamName})`);

        return classDeclaration;
    }

    private async retrieveDescribe (apiName: string): Promise<SObjectDescribe> {
        return await this.client.getSObjectDescribe(apiName);
    }

    private generatePropInterfaceName (className: string) {
        return `${className}Fields`;
    }

    private sanitizeClassName (sobConfig: SObjectConfig): string {
        if (sobConfig.autoConvertNames) {
            return cleanAPIName(sobConfig.apiName);
        }
        return sobConfig.apiName;
    }

    private sanitizeProperty (sobConfig: SObjectConfig, apiName: string, reference: boolean): string {
        let fieldMapping;
        if (sobConfig.fieldMappings) {
            fieldMapping = sobConfig.fieldMappings.find(mapping => {
                return mapping.apiName.toLowerCase() === apiName.toLowerCase();
            });
        }

        if (fieldMapping) {
            return fieldMapping.propName;
        }else if (sobConfig.autoConvertNames) {
            let s = cleanAPIName(apiName);
            return apiName.charAt(0).toLowerCase() + s.slice(1) + (reference && !apiName.endsWith('Id') ? 'Id' : '');
        }else {
            return apiName;
        }
    }

    private generateChildrenProps (sobConfig: SObjectConfig, children: ChildRelationship[]): PropertyDeclarationStructure[] {
        let props = [];
        children.forEach(child => {
            try {
                let relatedSobIndex = this.sObjectConfigs.findIndex(config => {
                    return config.apiName.toLowerCase() === child.childSObject.toLowerCase();
                });
                // don't generate if not in the list of types or ??
                if (relatedSobIndex === -1
                || child.childSObject === sobConfig.apiName
                || child.deprecatedAndHidden === true
                || child.relationshipName === null) {
                    return;
                }

                let referenceClass = this.sanitizeClassName(this.sObjectConfigs[relatedSobIndex]);

                let decoratorProps: SalesforceDecoratorProps = {
                    apiName: child.relationshipName,
                    required: false,
                    createable: false,
                    updateable: false,
                    childRelationship: true,
                    reference: referenceClass,
                    externalId: false,
                    salesforceLabel: child.relationshipName,
                    salesforceType: SalesforceFieldType.REFERENCE
                };

                props.push({
                    name: this.sanitizeProperty(sobConfig, child.relationshipName, false),
                    type: `${referenceClass}[]`,
                    scope: Scope.Public,
                    decorators: [
                        this.generateDecorator(decoratorProps)
                    ]
                });
            }catch (e) {
                throw e;
            }
        });
        return props;
    }

    private generateFieldProps (sobConfig: SObjectConfig, fields: Field[]): PropertyDeclarationStructure[] {
        let props = [];
        // add members
        fields.forEach(field => {

            try {
                let docs: JSDocStructure[] = [];
                if (field.inlineHelpText != null) {
                    docs.push({ description: field.inlineHelpText });
                }

                let relatedSobIndex = this.sObjectConfigs.findIndex(config => {
                    return config.apiName === field.referenceTo[0];
                });

                // only include reference types if we are also generating the referenced class
                if (
                    field.type === SalesforceFieldType.REFERENCE
                    && (
                        relatedSobIndex > -1
                    )
                    && field.relationshipName !== null
                ) {

                    let referenceClass: string;

                    if (field.referenceTo.length > 1) {
                        referenceClass = 'Name'; // polymorphic object
                    } else {
                        referenceClass = this.sanitizeClassName(this.sObjectConfigs[relatedSobIndex]);
                    }

                    let decoratorProps: SalesforceDecoratorProps = {
                        apiName: field.relationshipName,
                        required: false,
                        createable: false,
                        updateable: false,
                        childRelationship: false,
                        reference: referenceClass,
                        externalId: false,
                        salesforceLabel: field.label,
                        salesforceType: SalesforceFieldType.REFERENCE
                    };

                    props.push({
                        name: this.sanitizeProperty(this.sObjectConfigs[relatedSobIndex], field.relationshipName, false),
                        type: referenceClass,
                        scope: Scope.Public,
                        decorators: [
                            this.generateDecorator(decoratorProps)
                        ],
                        docs: docs
                    });
                }

                let prop: PropertyDeclarationStructure = {
                    name: this.sanitizeProperty(sobConfig, field.name, field.type === SalesforceFieldType.REFERENCE),
                    type: this.mapSObjectType(field.type),
                    scope: Scope.Public,
                    decorators: [this.getDecorator(field)],
                    docs: docs
                };

                props.push(prop);
            }catch (e) {
                throw e;
            }
        });
        return props;
    }

    private mapSObjectType (sfType: string): string {
        switch (sfType) {
            case SalesforceFieldType.DATETIME:
            case SalesforceFieldType.DATE:
                return 'Date';
            case SalesforceFieldType.BOOLEAN:
                return 'boolean';
            case SalesforceFieldType.DOUBLE:
            case SalesforceFieldType.INTEGER:
            case SalesforceFieldType.CURRENCY:
            case SalesforceFieldType.INT:
            case SalesforceFieldType.PERCENT:
                return 'number';
            case SalesforceFieldType.LOCATION:
                return 'SFLocation';
            case SalesforceFieldType.REFERENCE:
            case SalesforceFieldType.STRING:
            case SalesforceFieldType.PICKLIST:
            case SalesforceFieldType.ID:
            default:
                return 'string';
        }
    }

    private mapTypeToEnum (sfType: string): string {
        return `SalesforceFieldType.${sfType.toUpperCase()}`;
    }

    private getDecorator (field: Field): DecoratorStructure {
        let decoratorProps = {
            apiName: field.name,
            createable: field.createable,
            updateable: field.updateable,
            required: (field.createable || field.updateable) && field.nillable === false,
            externalId: field.externalId,
            childRelationship: false,
            reference: null,
            salesforceLabel: field.label,
            salesforceType: field.type
        };

        return this.generateDecorator(decoratorProps);
    }

    private generateDecorator (decoratorProps: SalesforceDecoratorProps) {
        let ref = decoratorProps.reference != null ? `()=>{return ${decoratorProps.reference}}` : 'undefined';
        let sfType = decoratorProps.salesforceType ? `${this.mapTypeToEnum(decoratorProps.salesforceType)}` : 'undefined';
        let label = decoratorProps.salesforceLabel ? decoratorProps.salesforceLabel.replace(/'/g, "\\'") : '';

        //  type ExchangeRates =
        let props: {
            [P in keyof Omit<SFieldProperties, 'toString'>]: string;
        } = {
            apiName: `'${decoratorProps.apiName}'`,
            createable: `${decoratorProps.createable}`,
            updateable: `${decoratorProps.updateable}`,
            required: `${decoratorProps.required}`,
            reference: `${ref}`,
            childRelationship: `${decoratorProps.childRelationship}`,
            salesforceType: `${sfType}`,
            salesforceLabel: `'${label}'`,
            externalId: `${decoratorProps.externalId}`
        };

        let propsString = Object.keys(props).map(key => {
            return `${key}: ${props[key]}`;
        }).join(', ');

        return {
            name: `sField`,
            arguments: [
                `{${propsString}}`
            ]
        };
    }

}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
