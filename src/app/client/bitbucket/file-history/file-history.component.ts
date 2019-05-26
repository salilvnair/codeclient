import { OnInit, Component, AfterViewInit, ViewChild, OnDestroy, ViewChildren } from '@angular/core';
import { BitbucketService } from '../service/bitbucket.service';
import { CommitHistoryData } from '../model/commit-history.model';
import { MatTableDataSource, MatPaginator, MatSort, PageEvent, MatSelect, MatCheckbox, MatCheckboxChange } from '@angular/material';
import * as dateFormat from 'dateformat';
import { MatHeaderProgressData } from 'src/app/util/mat-header-progress/mat-header-progress.data';
import { DateUtil } from 'src/app/util/date.util';
import { Subject, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ExcelUtil } from 'src/app/util/excel.util';
import { FileHistoryData } from '../model/file-history.model';
import { FileHistoryResponse } from 'src/app/api/rest/model/file-history.response';
import { CommitHistoryFilteredModel } from '../commit-history/commit-history-filter-dialog/commit-history-filter.model';

@Component({
    selector:'file-history',
    templateUrl:'./file-history.component.html',
    styleUrls:['./file-history.component.css'],  
})
export class FileHistoryComponent implements OnInit, AfterViewInit, OnDestroy  {

    constructor(private bitbucketService:BitbucketService,
                private dateUtil:DateUtil,
                private router: Router,
                private excelUtil:ExcelUtil,
                private matHeaderProgressData:MatHeaderProgressData){}
    dataSource = new MatTableDataSource<FileHistoryData>();
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChildren(MatCheckbox) checkboxes:MatCheckbox[];
    displayedColumns: string[] = ['select','author', 'commitId', 'commitMessage', 'date'];
    showSearchBox = false;
    showToolBarBtns = true;
    lovSelected = "all";
    strictMatch = false;    
    filterString:string = '';
    foundMatchCaseArray:string[]=[];
    notFoundMatchCaseArray:string[]=[];
    matchCaseArray:string[]=[];
    fileHistoryResponse:FileHistoryResponse;
    selectedBranchName:string  = 'master';
    selectedFilePath:string = '';
    fileHistoryFilteredModel: CommitHistoryFilteredModel;
    /** Subject that emits when the component has been destroyed. */
    protected _onDestroy = new Subject<void>();

    private commitIdsFileChangesSubscription = new Subscription();

    @ViewChild('branchSelect') branchSelect: MatSelect;

    ngOnInit(){
        this.init();
    }

    init() {
        this.redirectToDashBoardCheck();
        this.changeHeaderTitle(false);
        this.initFileHistoryTableDataSource();
    }

    redirectToDashBoardCheck() {
        if(!this.bitbucketService.getSelectedDashBoardData()) {
            this.router.navigate(["dashboard"]);
        }
    }

    changeHeaderTitle(defaultTitle:boolean) {
        if(defaultTitle){
            document.getElementById('headerTitle').innerText = "Code Client";
        }
        else{
            if(this.bitbucketService.getSelectedDashBoardData()) {
                document.getElementById('headerTitle').innerText = this.bitbucketService.getSelectedDashBoardData().repo_name;
            }
            else{
                document.getElementById('headerTitle').innerText = "Code Client";
            }
        }
    }

    initFileHistoryTableDataSource() {
        this.selectedBranchName = this.bitbucketService.getSelectedFileHistoryData().branchName;
        this.selectedFilePath = this.bitbucketService.getSelectedFileHistoryData().filePath;
        this.loadFileHistory('0','25');
        this.applyFilterPredicate();
    }

    ngAfterViewInit() {
     
    }
    
    ngOnDestroy() {
        this.changeHeaderTitle(true);
        this._onDestroy.next();
        this._onDestroy.complete();
        this.commitIdsFileChangesSubscription.unsubscribe();
    }

    loadFileHistory(start:string,limit:string) {
        this.matHeaderProgressData.setHidden(false);
        this.bitbucketService.getFileHistory(start,limit).subscribe(response=>{
            this.matHeaderProgressData.setHidden(true);
            let responseBody = response.body;
            this.fileHistoryResponse = responseBody;
            let fileHistoryDataSource= responseBody.values.map(({id,displayId,message,author,authorTimestamp})=>{
                let date = new Date(authorTimestamp); 
                let commitHistoryData = new CommitHistoryData();
                commitHistoryData.select = displayId;
                commitHistoryData.author = author.displayName?author.displayName:author.name;
                commitHistoryData.commitId = displayId;
                commitHistoryData.commitMessage = message;
                commitHistoryData.date = dateFormat(date,'dd/mm/yyyy hh:mm:ss');
                return commitHistoryData;
            })
            if(this.dataSource.data.length==0){
                //console.log(this.dataSource.data);
                this.dataSource.data = fileHistoryDataSource;
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;
            }
            else {
                fileHistoryDataSource.forEach(commitHistoryData=>{
                    this.dataSource.data.push(commitHistoryData);
                    this.dataSource.data = this.dataSource.data.slice(); 
                })
            }
        })
    }

    getNext(event: PageEvent) {      
        if(this.filterString==='' &&
            !this.fileHistoryResponse.isLastPage &&
            event.pageIndex > event.previousPageIndex &&
            event.pageIndex == Math.floor(event.length/event.pageSize)-1){
            ////console.log(this.commitHistoryResponse.nextPageStart);
            this.loadFileHistory(this.fileHistoryResponse.nextPageStart+'','25');
        }
    }

    fetchAllFileHistory() {
        this.loadFileHistory(this.fileHistoryResponse.nextPageStart+'','10000');
    }

    applyFilterPredicate() {
        this.dataSource.filterPredicate  = (data: CommitHistoryData, filter: string) => {
           let filterMatched = false;
           //console.log(data);
           if(this.fileHistoryFilteredModel){
            filterMatched = this.applyPopupFilter(data);
           }
           else{
            filterMatched = this.applySimpleFilter(data,filter);
           }
            return filterMatched;
           };
    }

    applyFilter(filterValue: string) {        
        this.foundMatchCaseArray = [];
        this.notFoundMatchCaseArray = [];
        this.matchCaseArray = [];
        this.fileHistoryFilteredModel = null;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    
        if (this.dataSource.paginator) {
          this.dataSource.paginator.firstPage();
        }
        if(this.strictMatch && this.lovSelected!='all' && this.matchCaseArray.length > 0) {
            this.dataSource.filteredData.map((filteredData=>{
                if(this.matchCaseArray.indexOf(filteredData[this.lovSelected])>-1){
                    this.foundMatchCaseArray.push(filteredData[this.lovSelected]);
                    this.matchCaseArray.splice(this.matchCaseArray.indexOf(filteredData[this.lovSelected]),1);
                }
            }))
            this.notFoundMatchCaseArray = this.matchCaseArray.filter(el=>{
                return this.foundMatchCaseArray.indexOf(el) === -1;
            })
        }

    }

    enableSearchBox() {
        this.showSearchBox = true;
        this.showToolBarBtns = false;
    }

    closeSearchBox() {
        this.showSearchBox = false;
        this.showToolBarBtns = true;
        this.filterString = '';
        this.applyFilter(this.filterString);
    }

    toggleMatchCase() {
        this.strictMatch = !this.strictMatch;
        this.applyFilter(this.filterString);
    }

    exportToExcel() {
        this.excelUtil.exportToExcel(this.dataSource.filteredData,this.bitbucketService.getSelectedDashBoardData().repo_slug,this.selectedBranchName);
    }

    openFilterDialog() {
        this.bitbucketService
            .openFilterDialog(this.displayedColumns,this.dataSource.data,this.fileHistoryFilteredModel)
            .subscribe(fileHistoryFilteredModel=>{
                this.fileHistoryFilteredModel = fileHistoryFilteredModel;
                if(this.fileHistoryFilteredModel && 
                    Object.keys(this.fileHistoryFilteredModel).length > 0) {
                    this.dataSource.filter = " ";
                    if (this.dataSource.paginator) {
                        this.dataSource.paginator.firstPage();
                    }
                }
                else{
                    this.filterString = '';
                    this.applyFilter(this.filterString);
                }
            })
    }

    applySimpleFilter(data: CommitHistoryData, filter: string) {
        if(filter.indexOf(",")!==-1 && this.lovSelected!='all'){
            const searchArray = filter.split(",").map(item => item.trim()).filter(v => v);
            //console.log(searchArray)
            this.matchCaseArray = searchArray;
            if(this.strictMatch){
                let el = searchArray.find(a=>{
                    let s =  a.includes(data[this.lovSelected]);
                    return s;
                }); 
                let foundElem = el!=undefined ? true:false;
                //searchArray.includes(data[this.lovSelected]);
                return foundElem;
            }
            else{
                const el =  searchArray.find(a=>{
                    return data[this.lovSelected].includes(a)
                });
                if(el){
                    return true;
                }
                else{
                    return false;
                }
            }
        }
        else{
            var cols = Object.keys(data);         
            for(let i=0;i<cols.length;i++){
                const textToSearch = data[cols[i]] && data[cols[i]].toLowerCase() || '';                
                let filterMatched = textToSearch.indexOf(filter) !== -1;
                if(filterMatched){
                    return filterMatched;
                }                
            }
        }
    }

    applyPopupFilter(data: CommitHistoryData) {
        //console.log(data)
        if(Object.keys(this.fileHistoryFilteredModel).length > 0){
            if (
                this.fileHistoryFilteredModel.fromDate &&
                this.fileHistoryFilteredModel.toDate &&
                this.fileHistoryFilteredModel.authors &&
                this.fileHistoryFilteredModel.authors.length ==0
              ) 
            {
                var fromDateSelected = this.dateUtil.parse(this.fileHistoryFilteredModel.fromDate);
                var toDateSelected = this.dateUtil.parse(this.fileHistoryFilteredModel.toDate);
                var objectDate = this.dateUtil.parse(data.date);
                return (
                  fromDateSelected.getTime() <= objectDate.getTime() &&
                  toDateSelected.getTime() >= objectDate.getTime()
                );
            } else if (
            this.fileHistoryFilteredModel.fromDate &&
            this.fileHistoryFilteredModel.toDate &&
            this.fileHistoryFilteredModel.authors &&
            this.fileHistoryFilteredModel.authors.length > 0
            ) {
                var fromDateSelected = this.dateUtil.parse(this.fileHistoryFilteredModel.fromDate);
                var toDateSelected = this.dateUtil.parse(this.fileHistoryFilteredModel.toDate);
                var objectDate = this.dateUtil.parse(data.date);
                let selectedAuthor = this.fileHistoryFilteredModel.authors.filter(
                    author => author === data.author
                );
                return (
                    selectedAuthor.length > 0 &&
                    fromDateSelected.getTime() <= objectDate.getTime() &&
                    toDateSelected.getTime() >= objectDate.getTime()
                );
            } 
            else if (this.fileHistoryFilteredModel.fromDate
                        && this.fileHistoryFilteredModel.authors.length > 0) {
                var fromDateSelected = this.dateUtil.parse(this.fileHistoryFilteredModel.fromDate);
                var objectDate = this.dateUtil.parse(data.date);
                let selectedAuthor = this.fileHistoryFilteredModel.authors.filter(
                    author => author === data.author
                );
                return (
                    selectedAuthor.length > 0 &&
                    fromDateSelected.getTime() <= objectDate.getTime()
                );
            } 
            else if (this.fileHistoryFilteredModel.fromDate 
                        && this.fileHistoryFilteredModel.authors.length == 0) {
                var fromDateSelected = this.dateUtil.parse(this.fileHistoryFilteredModel.fromDate);
                var objectDate = this.dateUtil.parse(data.date);
                return fromDateSelected.getTime() <= objectDate.getTime();
            } 
            else if (this.fileHistoryFilteredModel.authors.length > 0) {
                let selectedAuthor = this.fileHistoryFilteredModel.authors.filter(
                    author => author === data.author
                );
                return selectedAuthor.length > 0 ? true : false;
            } 
        } 
    }

    onSelectAllCommits(event:MatCheckboxChange) {
        this.dataSource.filteredData.forEach(commitLog=>{
            commitLog.checked = event.checked;
        });
        if(event.checked){
            this.onSelectCommit(event);
        }
    }

    onSelectCommit(event:MatCheckboxChange){

    }
}