import { Rest, RestObject, SObject, sField, SalesforceFieldType, SFLocation, SFieldProperties, FieldResolver, SOQLQueryParams, buildQuery, FieldProps } from "ts-force";
import { Account } from "./";

export type AccountHistoryFields = FieldProps<AccountHistory>;

/**
 * Generated class for AccountHistory
 */
export class AccountHistory extends RestObject {
    @sField({ apiName: 'Id', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.ID, salesforceLabel: 'Account History ID', externalId: false })
    public readonly id: string;
    @sField({ apiName: 'IsDeleted', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.BOOLEAN, salesforceLabel: 'Deleted', externalId: false })
    public readonly isDeleted: boolean;
    @sField({ apiName: 'Account', createable: false, updateable: false, required: false, reference: () => { return Account }, childRelationship: false, salesforceType: SalesforceFieldType.REFERENCE, salesforceLabel: 'Account ID', externalId: false })
    public account: Account;
    @sField({ apiName: 'AccountId', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.REFERENCE, salesforceLabel: 'Account ID', externalId: false })
    public readonly accountId: string;
    @sField({ apiName: 'CreatedById', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.REFERENCE, salesforceLabel: 'Created By ID', externalId: false })
    public readonly createdById: string;
    @sField({ apiName: 'CreatedDate', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.DATETIME, salesforceLabel: 'Created Date', externalId: false })
    public readonly createdDate: Date;
    @sField({ apiName: 'Field', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.PICKLIST, salesforceLabel: 'Changed Field', externalId: false })
    public readonly field: string;
    @sField({ apiName: 'OldValue', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.ANYTYPE, salesforceLabel: 'Old Value', externalId: false })
    public readonly oldValue: string;
    @sField({ apiName: 'NewValue', createable: false, updateable: false, required: false, reference: undefined, childRelationship: false, salesforceType: SalesforceFieldType.ANYTYPE, salesforceLabel: 'New Value', externalId: false })
    public readonly newValue: string;

    constructor(fields?: AccountHistoryFields, client?: Rest) {
        super('AccountHistory', client);
        this.id = void 0;
        this.isDeleted = void 0;
        this.account = void 0;
        this.accountId = void 0;
        this.createdById = void 0;
        this.createdDate = void 0;
        this.field = void 0;
        this.oldValue = void 0;
        this.newValue = void 0;
        Object.assign(this, fields);
        return new Proxy(this, this.safeUpdateProxyHandler);
    }

    public static API_NAME: 'AccountHistory' = 'AccountHistory';
    public _TYPE_: 'AccountHistory' = 'AccountHistory';
    private static _fields: { [P in keyof AccountHistoryFields]: SFieldProperties; };

    public static get FIELDS() {
        return this._fields = this._fields ? this._fields : AccountHistory.getPropertiesMeta<AccountHistoryFields, AccountHistory>(AccountHistory)
    }

    public static async retrieve(qryParam: ((fields: FieldResolver<AccountHistory>) => SOQLQueryParams) | string): Promise<AccountHistory[]> {

        let qry = typeof qryParam === 'function' ? buildQuery(AccountHistory, qryParam) : qryParam;
        return await RestObject.query<AccountHistory>(AccountHistory, qry);

    }

    public static fromSFObject(sob: SObject): AccountHistory {
        return new AccountHistory().mapFromQuery(sob);
    }
}
