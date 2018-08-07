export const cleanAPIName = (sfName: string) => {
    return sfName.replace('__c', '').replace('__r', '').replace(/_/g, '');
};
